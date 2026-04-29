import { createServerFn } from "@tanstack/react-start";

type IssueType = "bug" | "feature";

export type CreateIssuePayload = {
  issueType: IssueType;
  title: string;
  body: string;
};

export type CreateIssueResult = {
  number: number;
  html_url: string;
};

export const createGithubIssue = createServerFn({ method: "POST" })
  .inputValidator((data: CreateIssuePayload) => data)
  .handler(async ({ data }) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is not configured.");

    const label = data.issueType === "bug" ? "bug" : "feature";

    const res = await fetch(
      "https://api.github.com/repos/JaiiR320/DeckDiff/issues",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: data.title,
          body: data.body,
          labels: [label],
        }),
      },
    );

    if (!res.ok) {
      throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
    }

    return (await res.json()) as CreateIssueResult;
  });
