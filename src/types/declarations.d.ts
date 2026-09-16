declare module 'tree-kill' {
  function treeKill(pid: number, signal?: string | number, callback?: (error?: Error) => void): void
  export default treeKill
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}
