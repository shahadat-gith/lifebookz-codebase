import { useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  MdFormatBold,
  MdFormatItalic,
  MdFormatUnderlined,
  MdFormatListBulleted,
  MdFormatListNumbered,
  MdUndo,
  MdRedo,
} from "react-icons/md";
import { WizardShell } from "./WizardShell";
import { countWords, plainTextToHtml } from "../../../utils/richText";
import { Icons } from "../../../icons";

/**
 * Step 2 — the story itself. Rich text with the same tight toolbar the
 * reader will see: bold, italic, underline, lists. Content is optional in
 * the schema but the continue button asks for at least a few words.
 */
const TOOLBAR = [
  {
    key: "bold",
    label: "Bold",
    Icon: MdFormatBold,
    can: (editor) => editor.can().toggleBold(),
    active: (editor) => editor.isActive("bold"),
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    key: "italic",
    label: "Italic",
    Icon: MdFormatItalic,
    can: (editor) => editor.can().toggleItalic(),
    active: (editor) => editor.isActive("italic"),
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    key: "underline",
    label: "Underline",
    Icon: MdFormatUnderlined,
    can: (editor) => editor.can().toggleUnderline(),
    active: (editor) => editor.isActive("underline"),
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    key: "bulletList",
    label: "Bullet list",
    Icon: MdFormatListBulleted,
    can: (editor) => editor.can().toggleBulletList(),
    active: (editor) => editor.isActive("bulletList"),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    key: "orderedList",
    label: "Numbered list",
    Icon: MdFormatListNumbered,
    can: (editor) => editor.can().toggleOrderedList(),
    active: (editor) => editor.isActive("orderedList"),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
];

export default function ContentStep({
  story,
  onChange,
  onContinue,
  onBack,
}) {
  // Kept in a ref so the editor never reads stale wizard state.
  const storyRef = useRef(story);
  storyRef.current = story;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        link: false,
        strike: false,
        trailingNode: false,
      }),
      Placeholder.configure({
        placeholder: "Write your story here…",
      }),
    ],
    content: plainTextToHtml(story.content || ""),
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class:
          "rich-text min-h-[280px] max-h-[60vh] overflow-y-auto px-5 py-4 text-[15px] text-foreground focus:outline-none",
        "aria-label": "Story content",
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange({ ...storyRef.current, content: instance.getHTML() });
    },
  });

  const words = countWords(story.content);

  return (
    <WizardShell step={3} totalSteps={5} onBack={onBack}>
      <div className="rounded-2xl border border-border/70 bg-card shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 border-b border-border/60 px-2 py-1.5">
          {TOOLBAR.map(({ key, label, Icon, can, active, run }) => {
            const isActive = editor ? active(editor) : false;
            const isEnabled = editor ? can(editor) : false;

            return (
              <button
                key={key}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={isActive}
                disabled={!isEnabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor && run(editor)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
              </button>
            );
          })}

          <span className="mx-1.5 h-5 w-px bg-border/70" aria-hidden="true" />

          <button
            type="button"
            title="Undo"
            aria-label="Undo"
            disabled={!editor || !editor.can().undo()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor && editor.chain().focus().undo().run()}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30"
          >
            <MdUndo className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            title="Redo"
            aria-label="Redo"
            disabled={!editor || !editor.can().redo()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor && editor.chain().focus().redo().run()}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30"
          >
            <MdRedo className="h-[18px] w-[18px]" />
          </button>
        </div>

        <EditorContent editor={editor} />

        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5">
          <span className="text-xs text-muted-foreground">
            {words} {words === 1 ? "word" : "words"}
          </span>
          <span className="hidden text-xs text-muted-foreground/70 sm:block">
            Select text to bold, italicise or underline it
          </span>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={onContinue}
          disabled={words === 0}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3.5 font-display text-sm font-semibold shadow-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
          <Icons.chevronRight className="h-4 w-4" />
        </button>
      </div>
    </WizardShell>
  );
}
