const excapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}

const placeholder_code = '@#$ placeholder-code $#@'
const placeholder_split = '@#$ placeholder-split $#@'

const needExcape = /["'&<>]/g
const tags = /<\/?([^\/^\s^>]+)[^>]*?>/g
const splitter_tags = /<([^\/^\s^>]+)[^>]*?>[\s\S]*?<\/\1>/g
const splitters_text_patterns = [['。', 0], ['.', 1], ['，', 2], [',', 3], [' ', 4]]
const splitters_code_patterns = [['}', 0], ['{', 1], [';', 2], [' ', 3], [',', 4], ['.', 5]]

const selfcloseTags = new Set(['br', 'img', 'hr'])
const inlineElements = new Set(['code', 'tg-spoiler', 'b', 'a', 'i', 's'])
const inlineReplacements = [
    // Code should be high priority to escape its content first
    { regex: /`([^`]+?)`/g, replacement: (_, code) => `<code>${escapeHTML(code)}</code>` },
    // Spoilers (Telegram specific)
    { regex: /\|\|(.+?)\|\|/g, replacement: `<tg-spoiler>$1</tg-spoiler>` },
    // Links [text](url)
    { regex: /\[([^\]]+)\]\(([^)]+)\)/g, replacement: (_, text, url) => `<a href="${escapeHTML(url)}">${escapeHTML(text)}</a>` },
    // Autolinks <http://...> (optional, Telegram might handle them anyway)
    { regex: /<(https?:\/\/[^\s>]+)>/g, replacement: (_, url) => `<a href="${escapeHTML(url)}">${escapeHTML(url)}</a>` },
    // Bold (**text** or __text__)
    { regex: /\*\*(.+?)\*\*/g, replacement: `<b>$1</b>` },
    { regex: /__(.+?)__/g, replacement: `<b>$1</b>` },
    // Italic (*text* or _text_) - Careful regex needed for single chars if extending
    { regex: /\*([^\*]+?)\*/g, replacement: `<i>$1</i>` },
    { regex: /_([^_]+?)_/g, replacement: `<i>$1</i>` },
    // Strikethrough (~~text~~)
    { regex: /~~(.+?)~~/g, replacement: `<s>$1</s>` },
]

function escapeHTML_char(c) {
    switch (c) {
        case '"': return '&quot;'
        case '&': return '&amp;'
        case "'": return '&#39;'
        case '<': return '&lt;'
        case '>': return '&gt;'
        default: return c
    }
}

export function escapeHTML(str) {
    str = String(str)
    return str.replaceAll(needExcape, c => excapes[c]);
}

function LastIndex(str, patterns, start = str.length - 1, end = 0) {
    const last = new Array(patterns.length)
    const match = new Map(patterns)
    if (start < end) [start, end] = [end, start]
    for (let i = start; i >= end; i--) {
        const c = str[i]
        const m = match.get(c)
        if (m === undefined) continue
        if (m > 0) {
            last[m] = i
            match.delete(c)
            if (match.size === 0) break
        } else return i
    }
    for (let i = 0; i < patterns.length; i++)
        if (last[i] !== undefined) return last[i]
    return -1
}

function findSafeCutPoint(text, maxCutIndex) {
    if (maxCutIndex < 0) return -1
    let lastLtIndex = text.lastIndexOf('<', maxCutIndex)

    if (!(lastLtIndex < 0)
        && text.indexOf('>', lastLtIndex) > maxCutIndex
    ) return lastLtIndex

    let lastAmpIndex = text.lastIndexOf('&', maxCutIndex)
    if (!(lastAmpIndex < 0)
        && text.indexOf(';', lastAmpIndex) > maxCutIndex
    ) return lastAmpIndex

    return maxCutIndex
}

function connectParts(parts, maxLength) {
    const chunks = []
    let chunk = ''
    for (const part of parts) {
        if (chunk.length + part.length < maxLength)
            chunk += part
        else {
            chunks.push(chunk)
            chunk = part
        }
    }
    chunks.push(chunk)
    return chunks
}

export function toHTML(markdown) {
    if (!markdown) return ''

    const codes = []
    let i = 0
    return markdown
        .replace(/^```(\w+)?\n([\s\S]+?)\n```$/gm, (_, lang, code) => {
            const langClass = lang ? ` class="language-${escapeHTML(lang.trim())}"` : ''
            codes.push(`<pre><code${langClass}>${escapeHTML(code)}</code></pre>\n`)
            return placeholder_code
        })
        .replace(/^> (.*(?:\n> .*)*)$/gm, (_, content) => `<blockquote>${content.replace(/^> /gm, '')}</blockquote>\n`)
        .replace(/^#+ (.*)$/gm, (_, content) => `<b>${escapeHTML(content.trim())}</b>\n`)
        .split(/(\n)/)
        .reduce((html, block) => html + inlineReplacements.reduce((block, rule) => block.replace(rule.regex, rule.replacement), block), '')
        .replaceAll(placeholder_code, () => codes[i++])
        .trim()
}

export function splitHTML(html, maxLength = 4000) {
    if (!html?.length) return []
    if (maxLength <= 0 || html.length <= maxLength) return [html]

    const chunks = []

    // 先按独立标签分割
    const parts = []
    const tagSplitters = Array.from(html.matchAll(splitter_tags), match => match[0])
    const splited = html.replace(splitter_tags, placeholder_split).split(placeholder_split)
    for (let i = 0; i < tagSplitters.length; i++) {
        parts.push(splited[i])
        parts.push(tagSplitters[i])
    }
    parts.push(splited[splited.length - 1])

    // 再处理每个标签或文本
    parts.forEach(part => {
        if (part.length < maxLength) part && chunks.push(part)
        else {
            let tagSafe = true
            let minCut = 1
            let remaining = part
            while (remaining.length > 0) {
                // 寻找最优切割点
                let cutIndex = remaining.lastIndexOf('\n\n', maxLength)
                if (cutIndex < 0) cutIndex.lastIndexOf('\n', maxLength)
                if (cutIndex < 0) cutIndex = LastIndex(
                    remaining,
                    remaining.startsWith('<pre') ?
                        splitters_code_patterns :
                        splitters_text_patterns,
                    maxLength,
                )

                // 没找到直接切割
                cutIndex++
                cutIndex ||= maxLength
                cutIndex = findSafeCutPoint(remaining, cutIndex)
                if (cutIndex <= minCut) cutIndex = findSafeCutPoint(remaining, maxLength)
                if (cutIndex <= minCut) {
                    if (tagSafe) {
                        remaining = remaining.replaceAll(tags, '')
                        continue
                    } else cutIndex = maxLength
                }

                // 获取当前块内容
                let chunk = remaining.substring(0, cutIndex)
                remaining = remaining.substring(cutIndex)

                // 确保标签平衡
                let match = null
                if (tagSafe) {
                    const openTags = []
                    while ((match = tags.exec(chunk)) !== null) {
                        const fullTag = match[0]
                        const tagName = match[1].toLowerCase()

                        // 关闭标签
                        if (fullTag[1] === '/')
                            fullTag === openTags[openTags.length - 1].close && openTags.pop()
                        // 开始标签（非自闭合）
                        else if (!fullTag.endsWith('/>') && !selfcloseTags.has(tagName))
                            openTags.push({ open: fullTag, close: `</${tagName}>` })
                    }

                    if (openTags.length > 0) {
                        // 关闭标签
                        for (let i = openTags.length - 1; i >= 0; i--)
                            chunk += openTags[i].close

                        // 在下一块开始处添加打开标签
                        let reopenTags = ''
                        for (let i = 0; i < openTags.length; i++)
                            reopenTags += openTags[i].open
                        minCut = reopenTags.length || 1
                        if (tagSafe) {
                            if (reopenTags.length > maxLength * 0.5) {
                                tagSafe = false
                                remaining = remaining.replaceAll(tags, '')
                            }
                            else if (reopenTags === remaining) {
                                remaining = ''
                            } else remaining = reopenTags + remaining
                        }
                    }
                }
                chunks.push(chunk)
            }
        }
    })

    return connectParts(chunks, maxLength)
}

export class Transformer {
    constructor({ maxLength = 4096, onChunk = chunk => this.controller?.enqueue(chunk) }) {
        this.controller = null
        this.maxLength = maxLength
        this.onChunk = onChunk

        this.reset = () => {
            this.openTags = [{ tagName: 'b', open: '<b>', close: '</b>' }]
            this.openTags.pop()
            this.buffer = ''

            this.inBlockquote = false
            this.inTitle = false
            this.inCode = false

            this.inPre = 0
            this.inSpoiler = 0
            this.inBold = 0

            this.waitLine = false
            this.handle = this.LineStart
            this.searched = 0
            this.titleLevel = 0
            this.prelang = ''
        }

        this.reset()
    }

    start(controller) {
        this.controller = controller
    }

    transform(mdChunk, controller) {
        this.controller = controller ?? this.controller
        for (let i = 0; i < mdChunk.length; i++)
            this.scan(mdChunk[i])
    }

    flush(controller) {
        this.controller = controller ?? this.controller
        this.emit(this.buffer.length)
        this.reset()
    }

    emit(len = this.buffer.length) {
        len = Math.min(len, this.maxLength)
        const chunk = this.buffer.slice(0, len)
        const chunkHeader = this.openTags.map(tag => tag.open).join('')
        if (chunk.trim()) {
            const chunkFooter = [...this.openTags].reverse().map(tag => tag.close).join('')
            this.onChunk(chunk + chunkFooter)
        }
        this.buffer = chunkHeader + this.buffer.slice(len)
        this.searched = chunkHeader.length
    }

    scan(c) {
        if (c === '\n') {
            this.inSpoiler = 0
            this.inBold = 0

            if (this.inPre === 3) {
                this.inPre = 5

                const lang = this.prelang.trim()
                const langClass = lang ? ` class="language-${escapeHTML_char(lang)}"` : ''
                const open = `<pre><code${langClass}>`
                this.openTags.push({ tagName: 'precode', open, close: '</code></pre>' })
                this.buffer += open

                this.handle = this.PreCode
                return
            }

            if (this.inPre >= 4) {
                this.buffer += '\n```'.slice(0, this.inPre - 4) + '\n'
                this.inPre = 5
                this.handle = this.PreCode
                return
            }

            this.titleLevel = 0
            const closeInlines = []
            this.openTags = this.openTags.filter(tag => {
                if (inlineElements.has(tag.tagName)) {
                    closeInlines.push(this.openTags.pop()?.close || '')
                    return false
                }
                return true
            })
            this.buffer += closeInlines.reverse().join('')

            if (this.waitLine) {
                if (this.inBlockquote) {
                    this.inBlockquote = false
                    this.buffer += this.openTags.pop()?.close || ''
                }
                this.emit()
                return
            }

            this.buffer += c
            this.handle = this.LineStart

            this.buffer.length < this.maxLength / 2 ?
                this.waitLine = true :
                this.emit()
            return
        }

        this.waitLine = false
        this.handle(c)

        if (this.buffer.length > this.maxLength * 0.8) {
            if (this.buffer.length >= this.maxLength)
                return this.emit(findSafeCutPoint(this.buffer, this.maxLength))

            const i = findSafeCutPoint(
                this.buffer,
                LastIndex(
                    this.buffer,
                    this.inPre === 4 ?
                        splitters_code_patterns :
                        splitters_text_patterns,
                    this.buffer.length - 1,
                    this.searched
                )
            )

            i <= this.searched ?
                this.searched = this.buffer.length :
                this.emit(i)
        }
    }

    LineStart(c) {
        if (this.inBlockquote) {
            if (c === '>') {
                this.handle = this.NormalText
            } else {
                this.inBlockquote = false
                this.buffer += this.openTags.pop()?.close || ''
                this.emit()

                this.handle = this.LineStart
                this.handle(c)
            }
        }
        else switch (c) {
            case '#': {
                this.titleLevel = 1
                this.handle = this.Title
                break
            }
            case '>': {
                this.buffer.length && this.emit()
                this.inBlockquote = true

                const open = '<blockquote>'
                this.openTags.push({ tagName: 'blockquote', open, close: '</blockquote>' })
                this.buffer += open
                this.handle = this.NormalText
                break
            }
            case '`': {
                this.inPre = 1
                this.handle = this.NormalText
                break
            }
            default: {
                this.handle = this.NormalText
                this.handle(c)
                break
            }
        }
    }

    NormalText(c) {
        switch (c) {
            case '`':
                if (this.inPre === 0) this.handle = this.Code
                else {
                    this.inPre++
                    if (this.inPre === 3) {
                        this.buffer.length && this.emit()
                        this.handle = this.PreLang
                    }
                }
                break
            case '|':
                this.inSpoiler++
                switch (this.inSpoiler) {
                    case 2:
                        const open = `<tg-spoiler>`
                        this.openTags.push({ tagName: 'tg-spoiler', open, close: '</tg-spoiler>' })
                        this.buffer += open
                        break
                    case 4:
                        this.buffer += this.openTags.pop()?.close || ''
                        this.inSpoiler = 0
                        break
                }
                break
            case '*':
                this.inBold++
                switch (this.inBold) {
                    case 2:
                        const open = `<b>`
                        this.openTags.push({ tagName: 'b', open, close: '</b>' })
                        this.buffer += open
                        break
                    case 4:
                        this.buffer += this.openTags.pop()?.close || ''
                        this.inBold = 0
                        break
                }
                break
            default:
                if (this.inPre) {
                    this.inPre = 0
                    if (this.inPre === 1) {
                        this.handle = this.Code
                        this.handle(c)
                    }
                    return
                }

                if (this.inSpoiler & 1) {
                    this.inSpoiler--
                    this.buffer += '|'
                }

                if (this.inBold & 1) {
                    this.inBold--
                    this.buffer += '*'
                }

                this.buffer += escapeHTML_char(c)
                break
        }
    }

    PreLang(c) {
        if (c === ' ') return;
        this.prelang += escapeHTML_char(c)
    }

    PreCode(c) {
        if (this.inPre === 4) {
            this.buffer += escapeHTML_char(c)
            return
        }

        if (this.inPre > 4) {
            if (c === '`') this.inPre++
            else {
                this.buffer += '```'.slice(0, this.inPre - 5) + escapeHTML_char(c)
                this.inPre = 4
            }
        }

        if (this.inPre === 8) {
            this.inPre = 0
            this.buffer += this.openTags.pop()?.close || ''
            this.emit()
            this.handle = this.NormalText
            return
        }
    }

    Code(c) {
        if (!this.inCode) {
            this.inCode = true

            const open = `<code>`
            this.openTags.push({ tagName: 'code', open, close: '</code>' })
            this.buffer += open
        }

        if (c === '`') {
            this.inCode = false
            this.buffer += this.openTags.pop()?.close || ''
            this.handle = this.NormalText
        }
        else
            this.buffer += escapeHTML_char(c)
    }

    Title(c) {
        switch (c) {
            case '#': {
                this.titleLevel++
                break
            }
            case ' ': {
                // 确定是 title 尝试分割
                this.inTitle = true
                this.buffer.length && this.emit()

                const open = '<b>'
                this.openTags.push({ tagName: 'b', open, close: '</b>' })
                this.buffer += open

                this.handle = this.NormalText
                break
            }
            default: {
                // 不是 title
                this.buffer += '#'.repeat(this.titleLevel) + c
                this.titleLevel = 0
                this.handle = this.NormalText
                break
            }
        }
    }
}
