import * as vscode from 'vscode'
import TextmateLanguageService from 'vscode-textmate-languageservice'

const { getScopeInformationAtPosition } = TextmateLanguageService.api
const ERROR_DECORATION = vscode.window.createTextEditorDecorationType({
    // textDecoration: 'underline wavy red'
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    border: '1px solid rgba(255, 0, 0, 0.4)',
    overviewRulerColor: 'rgba(255, 0, 0, 0.7)'
})
const HIGHLIGHT_DECORATION = vscode.window.createTextEditorDecorationType({
    border: '1px solid #FFA500',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '2px',
})


export function activateHighlighter(context: vscode.ExtensionContext) {
    // console.log('正在启动highlighter监听器')
    const tagHighlighter = new TagHighlighter()
    let debounceTimer: NodeJS.Timeout | undefined

	const updateDecorations = async (editor: vscode.TextEditor) => {
        if (editor.document.languageId !== 'bbcode.nga') {
            return
        }

        const tags = TagParser.parse(editor.document.getText())
        const { endToStartMap, listItems, errorRegions } = await TagParser.analyzeTags(tags, editor.document)

        tagHighlighter.updateErrorRegions(editor, errorRegions)

        const cursorPositions = editor.selections.map(selection => 
            editor.document.offsetAt(selection.active)
        )
        tagHighlighter.updateHighlightRegions(editor, cursorPositions, endToStartMap, listItems)
    }

    const debouncedUpdate = (editor: vscode.TextEditor) => {
        if (debounceTimer) {
            clearTimeout(debounceTimer)
        }
        debounceTimer = setTimeout(() => updateDecorations(editor), 200)
    }

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                updateDecorations(editor)
            }
        }),
        vscode.workspace.onDidChangeTextDocument(event => {
            const editor = vscode.window.activeTextEditor
            if (editor && editor.document === event.document) {
                updateDecorations(editor)
            }
        }),
        vscode.window.onDidChangeTextEditorSelection(event => {
            debouncedUpdate(event.textEditor)
        }),
        tagHighlighter
    )

    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor)
    }
    // console.log('linter监听器启动完毕')
}


interface TagRegion {
    start: number
    end: number
    tag: string
    isEndTag: boolean
    suffix?: string
}

export class TagParser {
    private static readonly TAG_REGEX = /\[(\/)?([^=\[\] \d]+|\*)(\d+| [^\[\]]+|=[^\]]+)?\]/g

    public static parse(content: string): TagRegion[] {
        const tags: TagRegion[] = []
        let match: RegExpExecArray | null

        while (match = this.TAG_REGEX.exec(content)) {
            const [fullMatch, isEnd, tag, suffix] = match
            tags.push({
                start: match.index,
                end: match.index + fullMatch.length,
                tag,
                isEndTag: !!isEnd,
                suffix: suffix?.trim()
            })
        }

        return tags
    }

    public static async analyzeTags(tags: TagRegion[], document: vscode.TextDocument) {
        const tagStack: TagRegion[] = []
        const endToStartMap = new Map<string, TagRegion>()
        const listItems = new Map<string, TagRegion[]>()
        const errorRegions: TagRegion[] = []
        const listStack: TagRegion[] = []

        for (const tagRegion of tags) {
            // 跳过fixsize
            if (tagRegion.tag === 'fixsize') {
                continue
            }

            // 记录当前list所属[*]的区域
            if (tagRegion.tag === '*') {
                if (listStack.length > 0) {
                    const currentList = listStack[listStack.length - 1]
                    const listKey = `${currentList.start}-${currentList.end}`
                    if (!listItems.has(listKey)) {
                        listItems.set(listKey, [])
                    }
                    listItems.get(listKey)?.push(tagRegion)
                }
                continue
            }
            
            // 若非支持的BBCode tag, 则跳过
            const token = await getScopeInformationAtPosition(document, document.positionAt(tagRegion.start))
            if (!token.type.includes('tag.bbcode.nga')) {
                continue
            }

            // style在randomblock外进行警告
            if (tagRegion.tag === "style" && !token.scopes.includes("meta.randomblock.bbcode.nga")) {
                errorRegions.push(tagRegion)
            }

            // list多层嵌套处理
            if (tagRegion.tag === 'list') {
                if (!tagRegion.isEndTag) {
                    listStack.push(tagRegion)
                } else if (listStack.length > 0) {
                    listStack.pop()
                }
            }

            if (!tagRegion.isEndTag) {
                // 开头tag
                tagStack.push(tagRegion)
            } else {
                // 结尾tag
                if (tagStack.length > 0) {
                    const startTag = tagStack.pop()!
                    if (startTag.tag === tagRegion.tag) {
                        endToStartMap.set(`${tagRegion.start}-${tagRegion.end}`, startTag)
                    } else {
                        // 标记未闭合/不当闭合顺序代码块的开头tag
                        errorRegions.push(startTag)
                    }
                }
            }
        }

        // 标记未闭合代码块的开头tag
        errorRegions.push(...tagStack)

        return { endToStartMap, listItems, errorRegions }
    }
}

export class TagHighlighter {
    private readonly highlightDecorationType: vscode.TextEditorDecorationType
    private readonly errorDecorationType: vscode.TextEditorDecorationType
    private lastCursorPositions: number[] = []

    constructor() {
        this.highlightDecorationType = HIGHLIGHT_DECORATION
        this.errorDecorationType = ERROR_DECORATION
    }

    // 覆盖更新错误区域
    public updateErrorRegions(editor: vscode.TextEditor, errorRegions: TagRegion[]) {
        const ranges = errorRegions.map(region => 
            new vscode.Range(
                editor.document.positionAt(region.start),
                editor.document.positionAt(region.end)
            )
        )
        editor.setDecorations(this.errorDecorationType, ranges)
    }

    // 更新高亮提示
    public updateHighlightRegions(
        editor: vscode.TextEditor,
        cursorPositions: number[],
        endToStartMap: Map<string, TagRegion>,
        listItems: Map<string, TagRegion[]>
    ) {
        // 位置未变化时跳过
        if (this.positionsUnchanged(cursorPositions)) {
            return
        }

        this.lastCursorPositions = [...cursorPositions]
        const highlightRanges: vscode.Range[] = []

        for (const cursorPos of cursorPositions) {
            const position = editor.document.positionAt(cursorPos)
            
            for (const [endKey, startRegion] of endToStartMap) {
                const [endStart, endEnd] = endKey.split('-').map(Number)
                const cursorOffset = editor.document.offsetAt(position)
                
                // 若光标被该代码块包裹, 则高亮标记该代码块的tag
                if (startRegion.start <= cursorOffset && cursorOffset < endEnd) {
                    highlightRanges.push(
                        new vscode.Range(
                            editor.document.positionAt(startRegion.start),
                            editor.document.positionAt(startRegion.end)
                        ),
                        new vscode.Range(
                            editor.document.positionAt(endStart),
                            editor.document.positionAt(endEnd)
                        )
                    )

                    // 在list中, 从最后一个所属的[*]开始, 找第一个位于光标前面的[*]
                    if (editor.document.getText(
                        new vscode.Range(
                        editor.document.positionAt(endStart),
                        editor.document.positionAt(endEnd)
                    )) === '[/list]') {
                        const listKey = `${startRegion.start}-${startRegion.end}`
                        const items = listItems.get(listKey) || []
                        
                        for (const item of items.reverse()) {
                            if (item.start <= cursorOffset) {
                                highlightRanges.push(
                                    new vscode.Range(
                                        editor.document.positionAt(item.start),
                                        editor.document.positionAt(item.end)
                                    )
                                )
                                break
                            }
                        }
                    }
                }
            }
        }

        // 覆盖更新高亮区域
        editor.setDecorations(this.highlightDecorationType, highlightRanges)
    }

    // 判断光标是否移动
    private positionsUnchanged(newPositions: number[]): boolean {
        if (newPositions.length !== this.lastCursorPositions.length) {
            return false
        }
        return newPositions.every((pos, i) => pos === this.lastCursorPositions[i])
    }

    public dispose() {
        this.errorDecorationType.dispose()
        this.highlightDecorationType.dispose()
    }
}