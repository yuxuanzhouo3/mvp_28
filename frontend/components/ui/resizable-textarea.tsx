import * as React from "react"
import { cn } from "@/lib/utils"

interface ResizableTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeight?: number
  maxHeight?: number
  defaultHeight?: number
  onResize?: (height: number) => void
}

const ResizableTextarea = React.forwardRef<HTMLTextAreaElement, ResizableTextareaProps>(
  ({ 
    className, 
    minHeight = 96, // 24 * 4 = 96px (min-h-24)
    maxHeight = 384, // 24rem = 384px
    defaultHeight = 96,
    onResize,
    ...props 
  }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)
    const [height, setHeight] = React.useState(defaultHeight)

    // Combine refs
    React.useImperativeHandle(ref, () => textareaRef.current!)

    // Auto-resize based on content
    const adjustHeight = React.useCallback(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        const scrollHeight = textareaRef.current.scrollHeight
        const newHeight = Math.max(minHeight, Math.min(maxHeight, scrollHeight))
        setHeight(newHeight)
        onResize?.(newHeight)
      }
    }, [minHeight, maxHeight, onResize])

    React.useEffect(() => {
      adjustHeight()
    }, [props.value, adjustHeight])

    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          className={cn(
            "w-full resize-none overflow-hidden text-sm py-3 px-3 text-gray-900 dark:text-[#ececf1] bg-transparent border-0 focus:ring-0 focus:border-0 focus:outline-none outline-none rounded-xl selection:bg-blue-200 dark:selection:bg-blue-800 selection:text-gray-900 dark:selection:text-[#ececf1]",
            className
          )}
          style={{ height: `${height}px` }}
          {...props}
        />
      </div>
    )
  }
)

ResizableTextarea.displayName = "ResizableTextarea"

export { ResizableTextarea }
