export function cleanAiAnswer(value) {
  return String(value || '')
    .replace(/```[^\n]*\n?/g, '')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, '')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '• ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^\w])\*([^*\n]+)\*(?=$|[^\w])/gm, '$1$2')
    .replace(/(^|[^\w])_([^_\n]+)_(?=$|[^\w])/gm, '$1$2')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 ($2)')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, '')
    .replace(/\*\*|__/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
