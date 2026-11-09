import { Alert } from "@jaiir320/design-system/components/alert";
import { Button, buttonVariants } from "@jaiir320/design-system/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@jaiir320/design-system/components/dialog";
import { Empty, EmptyMedia } from "@jaiir320/design-system/components/empty";
import {
  Field,
  FieldControl,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@jaiir320/design-system/components/field";
import { Input } from "@jaiir320/design-system/components/input";
import { Textarea } from "@jaiir320/design-system/components/textarea";
import { ToggleGroup, ToggleGroupItem } from "@jaiir320/design-system/components/toggle-group";
import { useReducer } from "react";
import type { FormEvent } from "react";
import { Bug, Check, Lightbulb, MessageSquarePlus, X } from "lucide-react";
import { createGithubIssue } from "#/server/github";

type IssueType = "bug" | "feature";

type SubmitState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; issueNumber: number; issueUrl: string }
  | { status: "error"; message: string };

export function FeedbackButton() {
  const [state, setState] = useReducer(
    (
      current: {
        isOpen: boolean;
        issueType: IssueType;
        title: string;
        body: string;
        submitState: SubmitState;
      },
      next: Partial<typeof current>,
    ) => ({ ...current, ...next }),
    {
      isOpen: false,
      issueType: "bug" as IssueType,
      title: "",
      body: "",
      submitState: { status: "idle" } as SubmitState,
    },
  );
  const { isOpen, issueType, title, body, submitState } = state;

  function handleClose() {
    setState({
      isOpen: false,
      issueType: "bug",
      title: "",
      body: "",
      submitState: { status: "idle" },
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) return;

    setState({ submitState: { status: "loading" } });
    try {
      const result = await createGithubIssue({
        data: { issueType, title: trimmedTitle, body: trimmedBody },
      });
      setState({
        submitState: {
          status: "success",
          issueNumber: result.number,
          issueUrl: result.html_url,
        },
      });
    } catch (err) {
      setState({
        submitState: {
          status: "error",
          message: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        },
      });
    }
  }

  const isLoading = submitState.status === "loading";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => (open ? setState({ isOpen: true }) : handleClose())}
    >
      {/* Floating trigger button */}
      <DialogTrigger
        render={
          <Button
            variant="raised"
            size="icon-lg"
            aria-label="Send feedback"
            className="fixed right-6 bottom-6 z-(--z-sticky) rounded-xl border-border hover:border-border-strong hover:bg-surface"
          />
        }
      >
        <MessageSquarePlus className="size-5" strokeWidth={1.75} />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader className="items-center">
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogClose render={<Button variant="icon-ghost" size="icon-sm" aria-label="Close" />}>
            <X className="size-5" />
          </DialogClose>
        </DialogHeader>

        {/* Success state */}
        {submitState.status === "success" ? (
          <Empty className="mt-6 py-4 text-base">
            <EmptyMedia className="size-12 rounded-full border border-selected-border bg-info-surface/50">
              <Check className="size-6 text-primary" />
            </EmptyMedia>
            <div>
              <p className="text-base font-semibold text-foreground">Issue created!</p>
              <p className="mt-1 text-sm text-subtle-foreground">Thanks for your feedback.</p>
            </div>
            <a
              href={submitState.issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "link", size: "none", className: "text-sm" })}
            >
              View issue #{submitState.issueNumber} on GitHub
            </a>
            <DialogClose render={<Button />}>Close</DialogClose>
          </Empty>
        ) : (
          /* Form state */
          <form className="mt-5" onSubmit={handleSubmit}>
            {/* Issue type selector */}
            <FieldSet>
              <FieldLegend id="feedback-type-label">Type</FieldLegend>
              <ToggleGroup<IssueType>
                aria-labelledby="feedback-type-label"
                value={[issueType]}
                onValueChange={(value) => {
                  if (value[0]) setState({ issueType: value[0] });
                }}
              >
                {(["bug", "feature"] as const).map((type) => {
                  const label = type === "bug" ? "Bug Report" : "Feature Request";
                  const Icon = type === "bug" ? Bug : Lightbulb;
                  return (
                    <ToggleGroupItem<IssueType>
                      key={type}
                      value={type}
                      className="flex-1 not-data-pressed:bg-surface not-data-pressed:text-subtle-foreground not-data-pressed:hover:text-strong-foreground"
                    >
                      <Icon className="size-4" strokeWidth={1.75} />
                      {label}
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </FieldSet>

            {/* Title */}
            <Field className="mt-4">
              <FieldLabel>Title</FieldLabel>
              <Input
                id="feedback-title"
                required
                value={title}
                onValueChange={(value) => setState({ title: value })}
                placeholder="Brief summary"
              />
            </Field>

            {/* Description; pb keeps the gap the old inline textarea's line box left below it */}
            <Field className="mt-4 pb-[7px]">
              <FieldLabel>Description</FieldLabel>
              <FieldControl
                id="feedback-description"
                required
                value={body}
                onValueChange={(value) => setState({ body: value })}
                placeholder="Describe the issue or feature in detail…"
                render={<Textarea rows={5} className="resize-y" />}
              />
            </Field>

            {/* Error message */}
            {submitState.status === "error" && (
              <Alert role="alert" className="mt-3 text-destructive-text">
                {submitState.message}
              </Alert>
            )}

            {/* Actions */}
            <DialogFooter>
              <DialogClose render={<Button />}>Cancel</DialogClose>
              <Button
                type="submit"
                variant="default"
                disabled={isLoading || !title.trim() || !body.trim()}
              >
                {isLoading ? "Submitting…" : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
