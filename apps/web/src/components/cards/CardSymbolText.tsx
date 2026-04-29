import { useEffect, useState } from "react";
import { getCardSymbols, type CardSymbol } from "../../lib/scryfall";

type CardSymbolTextProps = {
  text: string;
  className?: string;
  symbolClassName?: string;
  as?: "span" | "div";
};

type CardTextToken = { type: "text"; value: string } | { type: "symbol"; value: string };

const CARD_SYMBOL_PATTERN = /(\{[^}]+\})/;

export function splitCardSymbolText(text: string): CardTextToken[] {
  return text
    .split(CARD_SYMBOL_PATTERN)
    .filter(Boolean)
    .map((part) => ({
      type: CARD_SYMBOL_PATTERN.test(part) ? "symbol" : "text",
      value: part,
    }));
}

export function CardSymbolText({
  text,
  className,
  symbolClassName,
  as = "span",
}: CardSymbolTextProps) {
  const [symbols, setSymbols] = useState<Map<string, CardSymbol> | null>(null);
  const hasSymbols = text.includes("{");

  useEffect(() => {
    if (!hasSymbols) {
      setSymbols(null);
      return;
    }

    let isCancelled = false;

    getCardSymbols()
      .then((nextSymbols) => {
        if (!isCancelled) {
          setSymbols(nextSymbols);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setSymbols(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [hasSymbols]);

  const Component = as;
  const tokens = splitCardSymbolText(text);

  return (
    <Component className={className}>
      {tokens.map((token, index) => {
        if (token.type === "text") {
          return <span key={`${index}-${token.value}`}>{token.value}</span>;
        }

        const symbol = symbols?.get(token.value);

        if (!symbol) {
          return <span key={`${index}-${token.value}`}>{token.value}</span>;
        }

        return (
          <img
            key={`${index}-${token.value}`}
            src={symbol.svgUri}
            alt={symbol.english}
            title={symbol.english}
            className={symbolClassName}
          />
        );
      })}
    </Component>
  );
}
