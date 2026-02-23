"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Youtube from "@tiptap/extension-youtube";
import { useCallback, useState } from "react";
import { EditorToolbar } from "./EditorToolbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Code, Eye } from "lucide-react";

interface NewsletterEditorProps {
  content: string;
  contentJson?: unknown;
  onChange: (html: string, json: unknown) => void;
  placeholder?: string;
}

export function NewsletterEditor({
  content,
  contentJson,
  onChange,
  placeholder = "Start writing your newsletter...",
}: NewsletterEditorProps) {
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [htmlContent, setHtmlContent] = useState(content);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline hover:text-blue-800",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder,
      }),
      Underline,
      TextStyle,
      Color,
      Youtube.configure({
        width: 640,
        height: 360,
        HTMLAttributes: {
          class: "w-full aspect-video rounded-lg",
        },
      }),
    ],
    content: contentJson || content,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base max-w-none min-h-[400px] p-4 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const json = editor.getJSON();
      setHtmlContent(html);
      onChange(html, json);
    },
  });

  const handleHtmlChange = useCallback(
    (value: string) => {
      setHtmlContent(value);
      if (editor) {
        editor.commands.setContent(value);
        onChange(value, editor.getJSON());
      }
    },
    [editor, onChange]
  );

  const toggleHtmlMode = useCallback(() => {
    if (isHtmlMode && editor) {
      // Switching from HTML to visual - update editor content
      editor.commands.setContent(htmlContent);
    } else if (editor) {
      // Switching to HTML - update HTML content
      setHtmlContent(editor.getHTML());
    }
    setIsHtmlMode(!isHtmlMode);
  }, [isHtmlMode, editor, htmlContent]);

  const addImage = useCallback(
    (url: string) => {
      if (editor) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
    [editor]
  );

  const addYoutubeVideo = useCallback(
    (url: string) => {
      if (editor) {
        editor.commands.setYoutubeVideo({ src: url });
      }
    },
    [editor]
  );

  const addLink = useCallback(
    (url: string) => {
      if (editor) {
        editor.chain().focus().setLink({ href: url }).run();
      }
    },
    [editor]
  );

  if (!editor) {
    return (
      <div className="border rounded-lg p-4 min-h-[500px] flex items-center justify-center">
        <p className="text-gray-500">Loading editor...</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between border-b bg-gray-50 px-3 py-2">
        <span className="text-sm text-gray-600">
          {isHtmlMode ? "HTML Mode" : "Visual Editor"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleHtmlMode}
          className="gap-2"
        >
          {isHtmlMode ? (
            <>
              <Eye className="h-4 w-4" />
              Visual
            </>
          ) : (
            <>
              <Code className="h-4 w-4" />
              HTML
            </>
          )}
        </Button>
      </div>

      {isHtmlMode ? (
        <Textarea
          value={htmlContent}
          onChange={(e) => handleHtmlChange(e.target.value)}
          className="min-h-[500px] font-mono text-sm border-0 rounded-none focus-visible:ring-0"
          placeholder="Paste or write HTML here..."
        />
      ) : (
        <>
          <EditorToolbar
            editor={editor}
            onAddImage={addImage}
            onAddVideo={addYoutubeVideo}
            onAddLink={addLink}
          />
          <EditorContent editor={editor} />
        </>
      )}
    </div>
  );
}
