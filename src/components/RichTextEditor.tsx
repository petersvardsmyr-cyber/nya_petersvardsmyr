import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bold, Italic, List, ListOrdered, Quote, Undo, Redo, Image as ImageIcon, Link as LinkIcon, Heading1, Heading2, Heading3, Upload, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        renderHTML: attributes => {
          if (!attributes.width) {
            return {};
          }
          return { width: attributes.width };
        },
      },
      height: {
        default: null,
        renderHTML: attributes => {
          if (!attributes.height) {
            return {};
          }
          return { height: attributes.height };
        },
      },
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const container = document.createElement('div');
      container.className = 'image-resizer-container';
      container.style.cssText = 'position: relative; display: inline-block; max-width: 100%; margin: 1rem 0;';

      const img = document.createElement('img');
      img.src = node.attrs.src;
      img.alt = node.attrs.alt || '';
      img.className = 'rounded-lg';
      img.style.cssText = 'display: block; max-width: 100%; height: auto; cursor: pointer;';
      
      if (node.attrs.width) {
        img.style.width = `${node.attrs.width}px`;
      }

      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.style.cssText = `
        position: absolute;
        bottom: 0;
        right: 0;
        width: 20px;
        height: 20px;
        background: hsl(var(--primary));
        border: 2px solid white;
        border-radius: 50%;
        cursor: nwse-resize;
        display: none;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      `;

      container.appendChild(img);
      container.appendChild(resizeHandle);

      let isResizing = false;
      let startX = 0;
      let startWidth = 0;

      container.addEventListener('mouseenter', () => {
        if (editor.isEditable) {
          resizeHandle.style.display = 'block';
        }
      });

      container.addEventListener('mouseleave', () => {
        if (!isResizing) {
          resizeHandle.style.display = 'none';
        }
      });

      resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        startX = e.clientX;
        startWidth = img.offsetWidth;

        const handleMouseMove = (e: MouseEvent) => {
          if (!isResizing) return;
          const deltaX = e.clientX - startX;
          const newWidth = Math.max(100, Math.min(startWidth + deltaX, container.parentElement?.offsetWidth || 800));
          img.style.width = `${newWidth}px`;
        };

        const handleMouseUp = () => {
          if (isResizing) {
            isResizing = false;
            resizeHandle.style.display = 'none';
            
            const pos = getPos();
            if (typeof pos === 'number') {
              editor.commands.updateAttributes('image', {
                width: img.offsetWidth,
              });
            }
          }
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      });

      return {
        dom: container,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'image') {
            return false;
          }
          img.src = updatedNode.attrs.src;
          if (updatedNode.attrs.width) {
            img.style.width = `${updatedNode.attrs.width}px`;
          }
          return true;
        },
      };
    };
  },
});

// Helper function to upload image file to Supabase Storage
const uploadImageToStorage = async (file: File): Promise<string | null> => {
  if (file.size > 10 * 1024 * 1024) {
    toast.error('Bilden är för stor. Max 10MB.');
    return null;
  }

  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `newsletter/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

  toast.loading('Laddar upp bild...', { id: 'paste-upload' });

  const { data, error } = await supabase.storage
    .from('blog-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Upload error:', error);
    toast.error('Kunde inte ladda upp bilden.', { id: 'paste-upload' });
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('blog-images')
    .getPublicUrl(data.path);

  toast.success('Bild uppladdad!', { id: 'paste-upload' });
  return urlData.publicUrl;
};

// Helper function to convert base64 to File
const base64ToFile = async (base64String: string, filename: string): Promise<File | null> => {
  try {
    const response = await fetch(base64String);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  } catch (error) {
    console.error('Error converting base64 to file:', error);
    return null;
  }
};

export function RichTextEditor({ content, onChange, placeholder = "Börja skriva..." }: RichTextEditorProps) {
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      ResizableImage.configure({
        inline: false,
        allowBase64: false, // IMPORTANT: Disable base64 to prevent large email payloads
        HTMLAttributes: {
          class: 'rounded-lg',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[300px] p-4 text-foreground',
        style: 'color: hsl(var(--foreground));',
      },
      // Handle paste events to intercept images and upload them
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
              uploadImageToStorage(file).then((url) => {
                if (url && view.state.tr) {
                  const { state } = view;
                  const node = state.schema.nodes.image.create({ src: url });
                  const transaction = state.tr.replaceSelectionWith(node);
                  view.dispatch(transaction);
                }
              });
            }
            return true;
          }
        }
        return false;
      },
      // Handle drop events to intercept images and upload them
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        const file = files[0];
        if (file.type.startsWith('image/')) {
          event.preventDefault();
          uploadImageToStorage(file).then((url) => {
            if (url && view.state.tr) {
              const { state } = view;
              const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (coordinates) {
                const node = state.schema.nodes.image.create({ src: url });
                const transaction = state.tr.insert(coordinates.pos, node);
                view.dispatch(transaction);
              }
            }
          });
          return true;
        }
        return false;
      },
    },
  });

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
    }
  }, [editor, content]);

  if (!editor) {
    return null;
  }

  const addImageFromUrl = () => {
    if (imageUrl) {
      const img = document.createElement('img');
      img.onload = () => {
        editor.chain().focus().setImage({ src: imageUrl }).run();
        setImageUrl('');
        setShowImageDialog(false);
        toast.success('Bild tillagd! Dra i den blå cirkeln i nedre högra hörnet för att ändra storlek.');
      };
      img.onerror = () => {
        toast.error('Kunde inte ladda bilden. Kontrollera URL:en.');
      };
      img.src = imageUrl;
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Bilden är för stor. Max 10MB.');
      return;
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `newsletter/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    toast.loading('Laddar upp bild...', { id: 'image-upload' });

    const { data, error } = await supabase.storage
      .from('blog-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      toast.error('Kunde inte ladda upp bilden. Försök igen.', { id: 'image-upload' });
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('blog-images')
      .getPublicUrl(data.path);

    editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
    toast.success('Bild tillagd! Dra i den blå cirkeln i nedre högra hörnet för att ändra storlek.', { id: 'image-upload' });
  };

  const addLink = () => {
    const url = window.prompt('Ange länk-URL');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="border border-input rounded-md overflow-hidden">
      <div className="border-b border-input p-2 flex flex-wrap gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive('heading', { level: 3 }) ? 'bg-muted' : ''}
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-muted' : ''}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-muted' : ''}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'bg-muted' : ''}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'bg-muted' : ''}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'bg-muted' : ''}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={editor.isActive({ textAlign: 'left' }) ? 'bg-muted' : ''}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={editor.isActive({ textAlign: 'center' }) ? 'bg-muted' : ''}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={editor.isActive({ textAlign: 'right' }) ? 'bg-muted' : ''}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={editor.isActive({ textAlign: 'justify' }) ? 'bg-muted' : ''}
        >
          <AlignJustify className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowImageDialog(!showImageDialog)}
          className={showImageDialog ? 'bg-muted' : ''}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addLink}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        <div className="ml-auto flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Image URL Dialog */}
      {showImageDialog && (
        <div className="border-b border-input p-4 bg-muted/50">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label htmlFor="image-url" className="text-sm font-medium mb-2 block">Bild-URL</Label>
              <Input
                id="image-url"
                type="url"
                placeholder="https://exempel.se/bild.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addImageFromUrl();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={addImageFromUrl}
              disabled={!imageUrl}
            >
              Lägg till
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowImageDialog(false);
                setImageUrl('');
              }}
            >
              Avbryt
            </Button>
          </div>
        </div>
      )}
      
      <EditorContent 
        editor={editor} 
        className="bg-background min-h-[300px] [&_.ProseMirror]:text-foreground [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:text-foreground [&_.ProseMirror_p]:text-base [&_.ProseMirror_p]:leading-relaxed [&_.ProseMirror_h1]:text-foreground [&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_h1]:mb-4 [&_.ProseMirror_h1]:mt-6 [&_.ProseMirror_h2]:text-foreground [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:mt-5 [&_.ProseMirror_h3]:text-foreground [&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-medium [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_strong]:text-foreground [&_.ProseMirror_strong]:font-bold [&_.ProseMirror_em]:text-foreground [&_.ProseMirror_em]:italic [&_.ProseMirror_img]:my-4 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ml-6 [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ml-6 [&_.ProseMirror_ol]:my-2 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-muted-foreground [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:my-4"
      />
    </div>
  );
}