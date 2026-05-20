import { useCallback, useRef } from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}

export function ResizeHandle({ direction, onResize }: ResizeHandleProps) {
  const dragging = useRef(false);
  const lastPos = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const current = direction === 'horizontal' ? ev.clientX : ev.clientY;
      const delta = current - lastPos.current;
      if (delta !== 0) {
        onResize(delta);
        lastPos.current = current;
      }
    };

    const handleMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction, onResize]);

  const isH = direction === 'horizontal';

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`group shrink-0 flex items-center justify-center z-40 ${
        isH
          ? 'w-1.5 cursor-col-resize hover:w-2 self-stretch'
          : 'h-1.5 cursor-row-resize hover:h-2 w-full'
      } transition-all`}
    >
      <div
        className={`rounded-full bg-white/10 group-hover:bg-primary-fixed-dim/50 group-active:bg-primary-fixed-dim transition-colors ${
          isH ? 'w-0.5 h-8' : 'h-0.5 w-8'
        }`}
      />
    </div>
  );
}
