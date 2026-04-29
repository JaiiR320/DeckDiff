package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

var (
	sectionHeadingPattern = regexp.MustCompile(`^(\d{1,2})\.\s+(.+)$`)
	ruleHeadingPattern    = regexp.MustCompile(`^(\d{3})\.\s+(.+)$`)
)

type section struct {
	Number int
	Title  string
	Rules  []rule
}

type rule struct {
	Number string
	Title  string
	Body   []string
}

type glossaryEntry struct {
	Term string
	Body []string
}

func main() {
	inputPath := flag.String("input", "rules.txt", "path to the comprehensive rules source file")
	outputPath := flag.String("output", "rules", "path to the generated rules directory")
	dryRun := flag.Bool("dry-run", false, "print planned output without writing files")
	flag.Parse()

	sections, glossary, err := parseRules(*inputPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "rulesgen: %v\n", err)
		os.Exit(1)
	}

	if *dryRun {
		for _, sec := range sections {
			fmt.Printf("%s\n", sectionDirName(sec))
			for _, rule := range sec.Rules {
				fmt.Printf("  %s\n", ruleFileName(rule))
			}
		}
		fmt.Printf("glossary/\n")
		for _, letter := range glossaryLetters() {
			fmt.Printf("  %s.md\n", strings.ToLower(string(letter)))
		}
		return
	}

	if err := writeRules(*outputPath, sections, glossary); err != nil {
		fmt.Fprintf(os.Stderr, "rulesgen: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("generated %d sections in %s\n", len(sections), *outputPath)
}

func parseRules(path string) ([]section, []glossaryEntry, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, nil, err
	}

	lines := strings.Split(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n")
	start, err := rulesBodyStart(lines)
	if err != nil {
		return nil, nil, err
	}

	glossaryIndex, err := findGlossaryStart(lines, start)
	if err != nil {
		return nil, nil, err
	}

	creditsIndex, err := findCreditsStart(lines, glossaryIndex)
	if err != nil {
		return nil, nil, err
	}

	var sections []section
	var currentSection *section
	var currentRule *rule

	flushRule := func() {
		if currentSection == nil || currentRule == nil {
			return
		}
		currentRule.Body = trimOuterBlankLines(currentRule.Body)
		currentSection.Rules = append(currentSection.Rules, *currentRule)
		currentRule = nil
	}

	flushSection := func() {
		if currentSection == nil {
			return
		}
		flushRule()
		sections = append(sections, *currentSection)
		currentSection = nil
	}

	for _, rawLine := range lines[start:glossaryIndex] {
		line := strings.TrimSpace(rawLine)

		if matches := sectionHeadingPattern.FindStringSubmatch(line); matches != nil {
			flushSection()

			number, err := strconv.Atoi(matches[1])
			if err != nil {
				return nil, nil, fmt.Errorf("parse section number %q: %w", matches[1], err)
			}

			currentSection = &section{
				Number: number,
				Title:  matches[2],
			}
			continue
		}

		if matches := ruleHeadingPattern.FindStringSubmatch(line); matches != nil {
			if currentSection == nil {
				return nil, nil, fmt.Errorf("rule %s appears before any section heading", matches[1])
			}

			flushRule()
			currentRule = &rule{
				Number: matches[1],
				Title:  matches[2],
			}
			continue
		}

		if currentRule != nil {
			currentRule.Body = append(currentRule.Body, rawLine)
		}
	}

	flushSection()

	if len(sections) == 0 {
		return nil, nil, errors.New("no sections parsed from rules body")
	}

	glossary, err := parseGlossary(lines[glossaryIndex+1 : creditsIndex])
	if err != nil {
		return nil, nil, err
	}

	return sections, glossary, nil
}

func rulesBodyStart(lines []string) (int, error) {
	occurrences := 0
	for i, line := range lines {
		if strings.TrimSpace(line) != "1. Game Concepts" {
			continue
		}

		occurrences++
		if occurrences == 2 {
			return i, nil
		}
	}

	return 0, errors.New(`could not locate second "1. Game Concepts" heading`)
}

func findGlossaryStart(lines []string, start int) (int, error) {
	for i := start; i < len(lines); i++ {
		line := lines[i]
		if strings.TrimSpace(line) == "Glossary" {
			return i, nil
		}
	}

	return 0, errors.New(`could not locate "Glossary" heading`)
}

func findCreditsStart(lines []string, start int) (int, error) {
	for i := start + 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == "Credits" {
			return i, nil
		}
	}

	return 0, errors.New(`could not locate "Credits" heading after glossary`)
}

func parseGlossary(lines []string) ([]glossaryEntry, error) {
	var entries []glossaryEntry

	for i := 0; i < len(lines); {
		for i < len(lines) && strings.TrimSpace(lines[i]) == "" {
			i++
		}
		if i >= len(lines) {
			break
		}

		term := strings.TrimSpace(lines[i])
		i++

		var body []string
		for i < len(lines) && strings.TrimSpace(lines[i]) != "" {
			body = append(body, lines[i])
			i++
		}

		if term == "" {
			continue
		}

		entries = append(entries, glossaryEntry{
			Term: term,
			Body: trimOuterBlankLines(body),
		})
	}

	if len(entries) == 0 {
		return nil, errors.New("no glossary entries parsed")
	}

	return entries, nil
}

func writeRules(outputDir string, sections []section, glossary []glossaryEntry) error {
	if err := os.RemoveAll(outputDir); err != nil {
		return fmt.Errorf("remove %s: %w", outputDir, err)
	}

	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return fmt.Errorf("create %s: %w", outputDir, err)
	}

	for _, sec := range sections {
		sectionDir := filepath.Join(outputDir, sectionDirName(sec))
		if err := os.MkdirAll(sectionDir, 0o755); err != nil {
			return fmt.Errorf("create %s: %w", sectionDir, err)
		}

		for _, rule := range sec.Rules {
			path := filepath.Join(sectionDir, ruleFileName(rule))
			content := renderRule(rule)
			if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
				return fmt.Errorf("write %s: %w", path, err)
			}
		}
	}

	if err := writeGlossary(outputDir, glossary); err != nil {
		return err
	}

	return nil
}

func writeGlossary(outputDir string, entries []glossaryEntry) error {
	glossaryDir := filepath.Join(outputDir, "glossary")
	if err := os.MkdirAll(glossaryDir, 0o755); err != nil {
		return fmt.Errorf("create %s: %w", glossaryDir, err)
	}

	byLetter := map[rune][]glossaryEntry{}
	for _, entry := range entries {
		letter := glossaryLetter(entry.Term)
		if letter == 0 {
			continue
		}
		byLetter[letter] = append(byLetter[letter], entry)
	}

	for _, letter := range glossaryLetters() {
		path := filepath.Join(glossaryDir, fmt.Sprintf("%s.md", strings.ToLower(string(letter))))
		content := renderGlossaryLetter(letter, byLetter[letter])
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			return fmt.Errorf("write %s: %w", path, err)
		}
	}

	return nil
}

func renderRule(rule rule) string {
	var b strings.Builder
	b.WriteString("# ")
	b.WriteString(rule.Number)
	b.WriteString(". ")
	b.WriteString(rule.Title)
	b.WriteString("\n")

	if len(rule.Body) > 0 {
		b.WriteString("\n")
		b.WriteString(strings.Join(rule.Body, "\n"))
		b.WriteString("\n")
	}

	return b.String()
}

func renderGlossaryLetter(letter rune, entries []glossaryEntry) string {
	var b strings.Builder
	b.WriteString("# ")
	b.WriteRune(letter)
	b.WriteString("\n")

	if len(entries) == 0 {
		return b.String()
	}

	b.WriteString("\n")
	for i, entry := range entries {
		if i > 0 {
			b.WriteString("\n")
		}
		b.WriteString("## ")
		b.WriteString(entry.Term)
		b.WriteString("\n")
		if len(entry.Body) > 0 {
			b.WriteString("\n")
			b.WriteString(strings.Join(entry.Body, "\n"))
			b.WriteString("\n")
		}
	}

	return b.String()
}

func sectionDirName(sec section) string {
	return fmt.Sprintf("%02d-%s", sec.Number, slugify(sec.Title))
}

func ruleFileName(rule rule) string {
	return fmt.Sprintf("%s-%s.md", rule.Number, slugify(rule.Title))
}

func slugify(s string) string {
	var b strings.Builder
	lastDash := true

	for _, r := range strings.ToLower(s) {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(r)
			lastDash = false
		case lastDash:
			continue
		default:
			b.WriteByte('-')
			lastDash = true
		}
	}

	return strings.Trim(b.String(), "-")
}

func trimOuterBlankLines(lines []string) []string {
	start := 0
	for start < len(lines) && strings.TrimSpace(lines[start]) == "" {
		start++
	}

	end := len(lines)
	for end > start && strings.TrimSpace(lines[end-1]) == "" {
		end--
	}

	return lines[start:end]
}

func glossaryLetter(term string) rune {
	for _, r := range term {
		if unicode.IsLetter(r) {
			return unicode.ToUpper(r)
		}
	}

	return 0
}

func glossaryLetters() []rune {
	letters := make([]rune, 0, 26)
	for r := 'A'; r <= 'Z'; r++ {
		letters = append(letters, r)
	}
	return letters
}
