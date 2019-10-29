import * as React from 'react';
import SyntaxHighlighter, { registerLanguage } from "react-syntax-highlighter/light";
import js from 'react-syntax-highlighter/languages/hljs/javascript';
import docco from 'react-syntax-highlighter/styles/hljs/docco'; 

registerLanguage('javascript', js);

export interface CodeDisplayProps {
  codeBlocks: string[],
  destroyBlock: (index: number) => void,
  moveBlock: (dragIdx: number, dropIdx: number) => void,
}

const CodeDisplay = ({ codeBlocks, destroyBlock, moveBlock }: CodeDisplayProps) => {
  const [draggedIdx, setDraggedIdx] = React.useState<number>(-1);

  const onDragStart = (e: React.DragEvent, i: number) => {
    setDraggedIdx(i);
  };

  const onDragOver = (e: React.DragEvent, i: number) => {
    if (draggedIdx !== i) e.preventDefault();
  };

  const onDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    moveBlock(draggedIdx, i);
    setDraggedIdx(-1);
  }

  const blocks = codeBlocks.map((block, index) => (
    <li
      className="block-code"
      draggable
      onDragStart={e => onDragStart(e, index)}
      onDragOver={e => onDragOver(e, index)}
      onDrop={e => onDrop(e, index)}
    >
      <SyntaxHighlighter language="javascript" style={docco}>
      {block}
      </SyntaxHighlighter>
      <button type="button" className="invisible destroy" onClick={() => destroyBlock(index)}>x</button>
    </li>
  ));

  return (
    <ul id="code-display">
      {blocks}
    </ul>
  );
};

const areEqual = (
  { codeBlocks: prevBlocks }: CodeDisplayProps,
  { codeBlocks: nextBlocks }: CodeDisplayProps,
): boolean => {
  if (prevBlocks.length !== nextBlocks.length) return false;
  for (let i = 0; i !== prevBlocks.length; i += 1) {
    if (prevBlocks[i] !== nextBlocks[i]) return false;
  }
  return true;
};

export default React.memo(CodeDisplay, areEqual);
