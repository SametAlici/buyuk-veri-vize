export type Week = { id: number; title: string; short: string; principle: string; body: string }
export type Question = { w: number; q: string; o: string[]; a: number; e: string }
export type Test = { title: string; desc: string; questions: Question[] }
