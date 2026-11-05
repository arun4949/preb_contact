/**
 * PrebWaterfallCard
 *
 * Framer code component for the preb.co hero. Shows Preb searching data
 * sources one after another for one candidate: personal email and cell
 * first, work contacts only as a fallback. Plays when 40% of the card is in
 * the viewport, pauses when it leaves, and loops scenario A, then B, then A.
 *
 * Self-contained: React only, inline styles, no Tailwind, no app imports.
 * Colors and type sizes mirror the Preb app's BoardUI theme (light mode).
 * Motion follows the motion direction spec: one master clock per scenario,
 * only transform / opacity / clip-path / background-color are animated,
 * every row and slot exists in the DOM from t=0 (no layout shift).
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 480
 */
import * as React from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

/* ------------------------------------------------------------------ */
/* Theme: BoardUI light tokens from src/styles/theme.css, as sRGB hex   */
/* ------------------------------------------------------------------ */

const T = {
    font: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    ink: "#0a0a0a", // text-primary (neutral-950)
    secondary: "#737373", // text-secondary (neutral-500)
    tertiary: "#a3a3a3", // text-tertiary / placeholder (neutral-400)
    surface: "#ffffff", // background-primary-default
    surface2: "#f7f7f7", // background-secondary-default
    surface3: "#ebebeb", // background-tertiary-default
    hairline: "#ebebeb", // border-button-default / separator-border
    avatarBg: "#d4d4d4", // avatar-neutral-background (neutral-300)
    successBg: "#d9f99d", // status-lime-background (lime-200)
    successText: "#3f6212", // status-lime-text (lime-800)
    warningBg: "#fef08a", // status-yellow-background (yellow-200)
    warningText: "#854d0e", // status-yellow-text (yellow-800)
    ring: "#404040", // agent-progress-ring (neutral-700)
    flash: "rgba(132, 204, 22, 0.18)", // chart-2-active (lime-500) at 18%
    shadow: "0 1px 1px 0 rgba(0, 0, 0, 0.05)", // shadow-card
}

/* Motion tokens from the spec */
const EASE_ENTER = "cubic-bezier(.4,0,.2,1)"
const EASE_OUT = "cubic-bezier(.23,1,.32,1)"

/* Layout: header 117 + steps 200 + footer 31 = 348px */
const CARD_HEIGHT = 348
const PAD_X = 16
const ROW_HEIGHT = 28
const BADGE = 22
const PILL_HEIGHT = 24

/* ------------------------------------------------------------------ */
/* State model                                                         */
/* ------------------------------------------------------------------ */

type Tone = "neutral" | "success" | "warning"

type Row = {
    id: string
    label: string
    domain?: string
    divider?: boolean
    visible: boolean
    status: { text: string; tone: Tone; spinner: boolean }
    shake: number
    flash: number
}

type Slot = {
    value: string | null
    muted: boolean
    verified: boolean
    dim: boolean
    promoted: boolean
    notFound: boolean
}

type Candidate = { id: string; name: string; initials: string; meta: string }

type State = {
    candidate: Candidate
    metaVisible: boolean
    rows: Row[]
    exiting: boolean
    slots: Slot[]
    count: number
    countDuration: number
    credits: number
    footerRight: string | null
}

type Op = (s: State) => State
type Step = { t: number; ops: Op[] }
type RowDef = { id: string; label: string; domain?: string; divider?: boolean }
type Scenario = { candidate: Candidate; rows: RowDef[]; duration: number; steps: Step[] }

/** Connector line above a row starts drawing this long before the row appears. */
const LINE_LEAD = 80

function freshSlot(): Slot {
    return { value: null, muted: false, verified: false, dim: false, promoted: false, notFound: false }
}

function initialState(sc: Scenario): State {
    return {
        candidate: sc.candidate,
        metaVisible: false,
        rows: sc.rows.map((r) => ({
            ...r,
            visible: false,
            status: { text: "Searching", tone: "neutral", spinner: true },
            shake: 0,
            flash: 0,
        })),
        exiting: false,
        slots: [0, 1, 2, 3].map(freshSlot),
        count: 0,
        countDuration: 0,
        credits: 0,
        footerRight: null,
    }
}

/* Operations used by the timelines */

const row =
    (id: string, patch: Partial<Row> | ((r: Row) => Partial<Row>)): Op =>
    (s) => ({
        ...s,
        rows: s.rows.map((r) => (r.id === id ? { ...r, ...(typeof patch === "function" ? patch(r) : patch) } : r)),
    })

const show = (id: string): Op => row(id, { visible: true })
const status = (id: string, text: string, tone: Tone, spinner = false): Op => row(id, { status: { text, tone, spinner } })
const shake = (id: string): Op => row(id, (r) => ({ shake: r.shake + 1 }))
const flash = (id: string): Op => row(id, (r) => ({ flash: r.flash + 1 }))
const showMeta: Op = (s) => ({ ...s, metaVisible: true })

const slot =
    (i: number, patch: Partial<Slot>): Op =>
    (s) => ({ ...s, slots: s.slots.map((sl, k) => (k === i ? { ...sl, ...patch } : sl)) })

const fill = (i: number, value: string, o: { muted?: boolean; verified?: boolean } = {}): Op =>
    slot(i, { value, muted: !!o.muted, verified: !!o.verified })
const notNeeded = (i: number): Op => slot(i, { dim: true })
const notFound = (i: number): Op => slot(i, { value: "Not found · 0 credits", muted: true, notFound: true })
const promote = (i: number): Op => slot(i, { promoted: true, muted: false })

const count =
    (n: number, duration = 0): Op =>
    (s) => ({ ...s, count: n, countDuration: duration })
const credits =
    (n: number): Op =>
    (s) => ({ ...s, credits: n })
const footer =
    (text: string): Op =>
    (s) => ({ ...s, footerRight: text })
const exitRows: Op = (s) => ({ ...s, exiting: true, slots: [0, 1, 2, 3].map(freshSlot) })

/** A row appears at `t`; its connector line starts LINE_LEAD ms earlier. */
function appear(t: number, id: string): Step {
    return { t: Math.max(0, t - LINE_LEAD), ops: [show(id)] }
}

/* ------------------------------------------------------------------ */
/* Scenarios (ms from scenario start)                                  */
/* ------------------------------------------------------------------ */

const MAYA: Candidate = {
    id: "maya",
    name: "Maya Okafor",
    initials: "MO",
    meta: "Senior Backend Engineer · Austin, TX",
}

const DANIEL: Candidate = {
    id: "daniel",
    name: "Daniel Reyes",
    initials: "DR",
    meta: "Staff Data Engineer · Denver, CO",
}

const PROFILE: RowDef = { id: "profile", label: "Candidate profile" }
const DIVIDER: RowDef = { id: "div", label: "··· 20+ more data sources ···", divider: true }

/* Scenario A: personal contacts found, fallbacks not needed (15.6s). */
const SCENARIO_A: Scenario = {
    candidate: MAYA,
    duration: 15600,
    rows: [
        PROFILE,
        { id: "apollo", label: "Apollo", domain: "apollo.io" },
        { id: "lusha", label: "Lusha", domain: "lusha.com" },
        { id: "hunter", label: "Hunter", domain: "hunter.io" },
        DIVIDER,
        { id: "pdl", label: "People Data Labs", domain: "peopledatalabs.com" },
        { id: "contactout", label: "ContactOut", domain: "contactout.com" },
    ],
    steps: [
        appear(0, "profile"),
        { t: 1400, ops: [status("profile", "Profile found", "success"), showMeta] },
        appear(2000, "apollo"),
        { t: 2700, ops: [status("apollo", "Not found", "neutral"), count(1)] },
        appear(3100, "lusha"),
        {
            t: 3800,
            ops: [
                status("lusha", "Work email + phone · kept as fallback", "neutral"),
                fill(2, "m.okafor@example.com", { muted: true }),
                fill(3, "(512) 555-0100", { muted: true }),
                count(2),
            ],
        },
        appear(4200, "hunter"),
        { t: 4900, ops: [status("hunter", "Personal email found", "warning")] },
        { t: 5500, ops: [status("hunter", "Checking", "warning", true)] },
        { t: 6200, ops: [status("hunter", "Failed check", "warning"), shake("hunter"), count(3)] },
        { t: 6700, ops: [show("div"), count(13, 1200)] },
        appear(8100, "pdl"),
        {
            t: 9100,
            ops: [
                status("pdl", "Personal email · verified 3/3", "success"),
                flash("pdl"),
                fill(0, "maya.okafor@example.com", { verified: true }),
                notNeeded(2),
                count(14),
                credits(6),
            ],
        },
        appear(9600, "contactout"),
        {
            t: 11500,
            ops: [
                status("contactout", "Cell · active line · name match", "success"),
                flash("contactout"),
                fill(1, "(512) 555-0147", { verified: true }),
                notNeeded(3),
                count(17),
                credits(26),
                footer("Personal contacts found"),
            ],
        },
        { t: 14700, ops: [exitRows] },
    ],
}

/* Scenario B: no personal email exists, work email used as fallback (12.7s). */
const SCENARIO_B: Scenario = {
    candidate: DANIEL,
    duration: 12700,
    rows: [
        PROFILE,
        { id: "rocketreach", label: "RocketReach", domain: "rocketreach.co" },
        { id: "kaspr", label: "Kaspr", domain: "kaspr.io" },
        DIVIDER,
        { id: "prospeo", label: "Prospeo", domain: "prospeo.io" },
        { id: "datagma", label: "Datagma", domain: "datagma.com" },
    ],
    steps: [
        appear(0, "profile"),
        { t: 1200, ops: [status("profile", "Profile found", "success"), showMeta] },
        appear(1800, "rocketreach"),
        {
            t: 2500,
            ops: [
                status("rocketreach", "Work email · kept as fallback", "neutral"),
                fill(2, "d.reyes@example.com", { muted: true }),
                count(1),
            ],
        },
        appear(2900, "kaspr"),
        { t: 3600, ops: [status("kaspr", "Not found", "neutral"), count(2)] },
        { t: 4000, ops: [show("div"), count(8, 1000)] },
        appear(5200, "prospeo"),
        {
            t: 6200,
            ops: [
                status("prospeo", "Cell · active line · name match", "success"),
                flash("prospeo"),
                fill(1, "(303) 555-0172", { verified: true }),
                notNeeded(3),
                count(9),
                credits(20),
            ],
        },
        appear(6700, "datagma"),
        { t: 7900, ops: [status("datagma", "No personal email", "neutral"), notFound(0), count(20)] },
        { t: 8400, ops: [promote(2), credits(22), footer("Work email used as fallback")] },
        { t: 11800, ops: [exitRows] },
    ],
}

const SCENARIOS = [SCENARIO_A, SCENARIO_B]

/** Scenario A's final state, used for reduced motion and the Framer canvas. */
function staticFinalState(): State {
    let s = initialState(SCENARIO_A)
    for (const step of SCENARIO_A.steps) {
        if (step.t > 11500) break
        for (const op of step.ops) s = op(s)
    }
    return { ...s, countDuration: 0 }
}

/* ------------------------------------------------------------------ */
/* CSS                                                                 */
/* ------------------------------------------------------------------ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
@keyframes pwcSpin { to { transform: rotate(360deg); } }
@keyframes pwcCardIn { from { opacity: 0; transform: translateY(24px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes pwcRowIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pwcRowOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-4px); } }
@keyframes pwcLineIn { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes pwcLineOut { from { transform: scaleY(1); } to { transform: scaleY(0); } }
@keyframes pwcFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes pwcFadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes pwcSlideOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-8px); } }
@keyframes pwcSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pwcWipe { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
`

function useInjectedCss() {
    React.useEffect(() => {
        if (typeof document === "undefined") return
        if (document.getElementById("pwc-css")) return
        const el = document.createElement("style")
        el.id = "pwc-css"
        el.textContent = CSS
        document.head.appendChild(el)
    }, [])
}

/* ------------------------------------------------------------------ */
/* Icons (stroke 1.5, currentColor)                                    */
/* ------------------------------------------------------------------ */

function Icon({ name, size = 13 }: { name: string; size?: number }) {
    const paths: Record<string, React.ReactNode> = {
        mail: (
            <>
                <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
                <path d="m2.5 4.5 5.5 4 5.5-4" />
            </>
        ),
        mobile: (
            <>
                <rect x="4.5" y="1.5" width="7" height="13" rx="1.5" />
                <path d="M7 12.25h2" />
            </>
        ),
        briefcase: (
            <>
                <rect x="2" y="5" width="12" height="8.5" rx="1.5" />
                <path d="M6 5V3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V5M2 9h12" />
            </>
        ),
        phone: (
            <path d="M3.5 2.5h2l1 2.5-1.5 1a7 7 0 0 0 4 4l1-1.5 2.5 1v2a1 1 0 0 1-1 1A9.5 9.5 0 0 1 2.5 3.5a1 1 0 0 1 1-1Z" />
        ),
        person: (
            <>
                <circle cx="8" cy="5.5" r="2.75" />
                <path d="M2.75 14a5.25 5.25 0 0 1 10.5 0" />
            </>
        ),
        check: <path d="m3.5 8.5 3 3 6-7" />,
        close: <path d="m4 4 8 8M12 4l-8 8" />,
        alert: <path d="M8 3v6M8 12.5v.5" />,
    }
    return (
        <svg
            aria-hidden
            viewBox="0 0 16 16"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, display: "block" }}
        >
            {paths[name]}
        </svg>
    )
}

/** Provider logo from the site's favicon, with a letter fallback. */
function Logo({ label, domain }: { label: string; domain: string }) {
    const [failed, setFailed] = React.useState(false)
    if (failed) {
        return (
            <span style={{ fontSize: 11, fontWeight: 600, color: T.secondary, lineHeight: 1 }}>{label.charAt(0)}</span>
        )
    }
    return (
        <img
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
            alt=""
            width={14}
            height={14}
            loading="eager"
            decoding="async"
            onError={() => setFailed(true)}
            style={{ width: 14, height: 14, display: "block", borderRadius: 3 }}
        />
    )
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Spinner({ animate, size = 12 }: { animate: boolean; size?: number }) {
    return (
        <svg
            aria-hidden
            viewBox="0 0 14 14"
            style={{
                width: size,
                height: size,
                flexShrink: 0,
                display: "block",
                animation: animate ? "pwcSpin 700ms linear infinite, pwcFadeIn 150ms ease both" : "none",
            }}
        >
            <circle cx="7" cy="7" r="5.75" fill="none" stroke={T.hairline} strokeWidth="1.75" />
            <circle
                cx="7"
                cy="7"
                r="5.75"
                fill="none"
                stroke={T.ring}
                strokeWidth="1.75"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="0.3 0.7"
            />
        </svg>
    )
}

const CHIP: Record<Tone, React.CSSProperties> = {
    neutral: { background: T.surface3, color: T.secondary },
    success: { background: T.successBg, color: T.successText },
    warning: { background: T.warningBg, color: T.warningText },
}

function chipIcon(text: string, tone: Tone, spinner: boolean): string | null {
    if (spinner) return null
    if (tone === "success") return "check"
    if (tone === "warning") return "alert"
    if (/^not found|^no personal/i.test(text)) return "close"
    return null
}

function Chip({ tone, icon, children }: { tone: Tone; icon?: string | null; children: React.ReactNode }) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                borderRadius: 6,
                padding: "2px 6px",
                fontSize: 11,
                lineHeight: "15px",
                fontWeight: 500,
                letterSpacing: 0.2,
                whiteSpace: "nowrap",
                ...CHIP[tone],
            }}
        >
            {icon ? <Icon name={icon} size={11} /> : null}
            {children}
        </span>
    )
}

type Enter = "slide" | "wipe" | "fade"

/**
 * A grid cell with overflow hidden. When `k` changes the previous child
 * leaves and the new child enters per the motion spec (3.2, 3.7, 3.11).
 * Both children share the cell while swapping, so the cell keeps the larger
 * width and nothing jumps.
 */
function Swap({
    k,
    enter = "slide",
    style,
    align = "start",
    children,
}: {
    k: string
    enter?: Enter
    style?: React.CSSProperties
    align?: "start" | "end"
    children: React.ReactNode
}) {
    const [prev, setPrev] = React.useState<{ k: string; node: React.ReactNode } | null>(null)
    const last = React.useRef({ k, node: children })
    const pending = React.useRef<{ k: string; node: React.ReactNode } | null>(null)

    if (k !== last.current.k) {
        pending.current = last.current
        last.current = { k, node: children }
    } else {
        last.current.node = children
    }

    React.useEffect(() => {
        if (!pending.current) return
        setPrev(pending.current)
        pending.current = null
        const id = window.setTimeout(() => setPrev(null), enter === "wipe" ? 560 : 320)
        return () => window.clearTimeout(id)
    }, [k, enter])

    const enterAnim =
        enter === "wipe"
            ? `pwcWipe 450ms ${EASE_OUT} 100ms both`
            : enter === "fade"
              ? `pwcFadeIn 200ms ${EASE_OUT} 100ms both`
              : `pwcSlideIn 200ms ${EASE_OUT} 60ms both`
    const exitAnim =
        enter === "slide" ? `pwcSlideOut 200ms ${EASE_OUT} forwards` : `pwcFadeOut 150ms ${EASE_OUT} forwards`

    const cell: React.CSSProperties = {
        gridArea: "1 / 1",
        display: "flex",
        alignItems: "center",
        justifyContent: align === "end" ? "flex-end" : "flex-start",
        minWidth: 0,
    }

    return (
        <div style={{ display: "grid", overflow: "hidden", minWidth: 0, ...style }}>
            {prev && (
                <div key={"prev-" + prev.k} style={{ ...cell, animation: exitAnim, pointerEvents: "none" }}>
                    {prev.node}
                </div>
            )}
            <div key={k} style={{ ...cell, animation: prev ? enterAnim : undefined }}>
                {children}
            </div>
        </div>
    )
}

/** Integer tween, linear, text updated at most every 50ms (spec 3.10). */
function useTween(target: number, duration: number) {
    const [display, setDisplay] = React.useState(target)
    const from = React.useRef(target)
    React.useEffect(() => {
        const start = from.current
        if (duration <= 0 || start === target) {
            from.current = target
            setDisplay(target)
            return
        }
        const t0 = performance.now()
        let last = -Infinity
        let raf = 0
        const tick = () => {
            const now = performance.now()
            const p = Math.min(1, (now - t0) / duration)
            if (p >= 1 || now - last >= 50) {
                last = now
                setDisplay(Math.round(start + (target - start) * p))
            }
            if (p < 1) raf = requestAnimationFrame(tick)
            else from.current = target
        }
        raf = requestAnimationFrame(tick)
        return () => {
            cancelAnimationFrame(raf)
            from.current = target
        }
    }, [target, duration])
    return display
}

/* ------------------------------------------------------------------ */
/* Player: one master clock per scenario                               */
/* ------------------------------------------------------------------ */

function usePlayer(playing: boolean, loop: boolean, active: boolean) {
    const [state, setState] = React.useState<State>(() => initialState(SCENARIOS[0]))
    const ref = React.useRef({ idx: 0, elapsed: 0, startedAt: 0, fired: 0, lastFrame: 0, raf: 0, done: false })

    React.useEffect(() => {
        if (!active || !playing || ref.current.done) return
        const r = ref.current
        r.startedAt = performance.now() - r.elapsed
        r.lastFrame = performance.now()

        const tick = () => {
            const now = performance.now()
            // A long gap (hidden tab) counts as a pause, not as elapsed time.
            if (now - r.lastFrame > 1000) r.startedAt += now - r.lastFrame
            r.lastFrame = now
            r.elapsed = now - r.startedAt
            const sc = SCENARIOS[r.idx]
            while (r.fired < sc.steps.length && sc.steps[r.fired].t <= r.elapsed) {
                const step = sc.steps[r.fired++]
                setState((s) => step.ops.reduce((acc, op) => op(acc), s))
            }
            if (r.elapsed >= sc.duration) {
                if (!loop && r.idx === SCENARIOS.length - 1) {
                    r.done = true
                    return
                }
                r.idx = (r.idx + 1) % SCENARIOS.length
                r.fired = 0
                r.elapsed = 0
                r.startedAt = now
                setState(initialState(SCENARIOS[r.idx]))
            }
            r.raf = requestAnimationFrame(tick)
        }
        r.raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(r.raf)
    }, [playing, loop, active])

    return state
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

type Props = {
    loop?: boolean
    label?: string
    style?: React.CSSProperties
}

export default function PrebWaterfallCard({ loop = true, label = "", style }: Props) {
    useInjectedCss()

    const rootRef = React.useRef<HTMLDivElement>(null)
    const [visible, setVisible] = React.useState(false)
    const [entered, setEntered] = React.useState(false)
    const [narrow, setNarrow] = React.useState(false)
    const [reduceMotion, setReduceMotion] = React.useState(false)

    const onCanvas =
        typeof RenderTarget !== "undefined" &&
        typeof RenderTarget.current === "function" &&
        RenderTarget.current() === RenderTarget.canvas

    React.useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReduceMotion(mq.matches)
        const onChange = () => setReduceMotion(mq.matches)
        mq.addEventListener?.("change", onChange)
        return () => mq.removeEventListener?.("change", onChange)
    }, [])

    React.useEffect(() => {
        // Phone layout (auto height) only when the screen itself is narrow.
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(max-width: 519px)")
        setNarrow(mq.matches)
        const onChange = () => setNarrow(mq.matches)
        mq.addEventListener?.("change", onChange)
        return () => mq.removeEventListener?.("change", onChange)
    }, [])

    const isStatic = reduceMotion || onCanvas

    React.useEffect(() => {
        const el = rootRef.current
        if (!el || isStatic || typeof IntersectionObserver === "undefined") return
        const io = new IntersectionObserver(
            ([entry]) => {
                const on = entry.isIntersecting && entry.intersectionRatio >= 0.4
                setVisible(on)
                if (on) setEntered(true)
            },
            { threshold: [0, 0.4, 1] }
        )
        io.observe(el)
        return () => io.disconnect()
    }, [isStatic])

    const live = usePlayer(visible, loop, !isStatic)
    const staticState = React.useMemo(staticFinalState, [])
    const s = isStatic ? staticState : live
    const animate = !isStatic

    const countShown = useTween(s.count, animate ? s.countDuration : 0)

    return (
        <div ref={rootRef} style={{ width: "100%", fontFamily: T.font, color: T.ink, ...style }}>
            <p
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0 0 0 0)",
                    whiteSpace: "nowrap",
                    border: 0,
                }}
            >
                Example: Preb looks for a candidate's personal email and cell first, and uses work contacts
                only when no personal contact is found.
            </p>

            <div aria-hidden="true" style={{ maxWidth: 480, margin: "0 auto" }}>
                {label ? (
                    <div
                        style={{
                            fontSize: 12,
                            lineHeight: "16px",
                            fontWeight: 500,
                            letterSpacing: 0.15,
                            textTransform: "uppercase",
                            color: T.tertiary,
                            marginBottom: 10,
                            opacity: animate && !entered ? 0 : 1,
                            animation: animate && entered ? "pwcFadeIn 250ms ease 250ms both" : undefined,
                        }}
                    >
                        {label}
                    </div>
                ) : null}

                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        height: narrow ? "auto" : CARD_HEIGHT,
                        boxSizing: "border-box",
                        background: T.surface,
                        border: `1px solid ${T.hairline}`,
                        borderRadius: 16,
                        boxShadow: T.shadow,
                        overflow: "hidden",
                        opacity: animate && !entered ? 0 : 1,
                        animation: animate && entered ? `pwcCardIn 600ms ${EASE_ENTER} both` : undefined,
                    }}
                >
                    {/* Header: identity + contact pills */}
                    <div style={{ padding: `10px ${PAD_X}px`, borderBottom: `1px solid ${T.hairline}` }}>
                        <Swap k={s.candidate.id} enter="fade" style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                <div
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 999,
                                        background: T.avatarBg,
                                        color: T.secondary,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        flexShrink: 0,
                                    }}
                                >
                                    {s.candidate.initials}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 14, lineHeight: "20px", fontWeight: 500, color: T.ink }}>
                                        {s.candidate.name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            lineHeight: "16px",
                                            fontWeight: 400,
                                            color: T.secondary,
                                            visibility: s.metaVisible ? "visible" : "hidden",
                                            animation:
                                                animate && s.metaVisible ? `pwcWipe 500ms ${EASE_OUT} both` : undefined,
                                        }}
                                    >
                                        {s.candidate.meta}
                                    </div>
                                </div>
                            </div>
                        </Swap>

                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <PillRow label="Personal" slots={[s.slots[0], s.slots[1]]} indices={[0, 1]} animate={animate} />
                            <PillRow label="Work" slots={[s.slots[2], s.slots[3]]} indices={[2, 3]} animate={animate} />
                        </div>
                    </div>

                    {/* Steps */}
                    <div style={{ flex: 1, padding: `4px ${PAD_X}px 0`, overflow: "hidden" }}>
                        {s.rows.map((r, i) => (
                            <StepRow key={r.id} row={r} index={i} total={s.rows.length} exiting={s.exiting} animate={animate} />
                        ))}
                    </div>

                    {/* Footer */}
                    <div
                        style={{
                            height: 30,
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: `0 ${PAD_X}px`,
                            borderTop: `1px solid ${T.hairline}`,
                            background: T.surface2,
                            fontSize: 12,
                            lineHeight: "16px",
                            color: T.secondary,
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        <span>Searched {countShown} of 20+ sources</span>
                        <Swap k={s.footerRight ?? "credits"} align="end" style={{ height: 18 }}>
                            <span>{s.footerRight ?? `Credits used: ${s.credits}`}</span>
                        </Swap>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Contact pills (header)                                              */
/* ------------------------------------------------------------------ */

const SLOT_ICONS = ["mail", "mobile", "briefcase", "phone"]
const SLOT_SEARCH_LABELS = ["Email", "Cell", "Email", "Phone"]

function PillRow({
    label,
    slots,
    indices,
    animate,
}: {
    label: string
    slots: Slot[]
    indices: number[]
    animate: boolean
}) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", alignItems: "center", gap: 8 }}>
            <span
                style={{
                    width: 50,
                    fontSize: 11,
                    lineHeight: "15px",
                    fontWeight: 500,
                    letterSpacing: 0.2,
                    color: T.tertiary,
                    whiteSpace: "nowrap",
                }}
            >
                {label}
            </span>
            <Pill index={indices[0]} slot={slots[0]} animate={animate} />
            <Pill index={indices[1]} slot={slots[1]} animate={animate} />
        </div>
    )
}

function Pill({ index, slot, animate }: { index: number; slot: Slot; animate: boolean }) {
    const primary = index < 2
    const filled = slot.value !== null
    const ok = slot.verified || slot.promoted
    const borderColor = ok ? T.successText : T.hairline
    const borderStyle = primary || slot.promoted ? "solid" : "dashed"
    const background = primary || slot.promoted ? T.surface : T.surface2
    const valueColor = !filled || slot.muted ? T.tertiary : T.ink

    // 3.7 step 3: primary border turns green at 300ms over 250ms.
    // 3.8 NOT NEEDED: opacity .5 over 300ms, 200ms after the primary fills.
    // 3.8 USED: border style snaps, colors 300ms EASE_OUT.
    const transition = animate
        ? slot.promoted
            ? `border-color 300ms ${EASE_OUT}, background-color 300ms ${EASE_OUT}, opacity 300ms ${EASE_OUT}`
            : `border-color 250ms ${EASE_OUT} 300ms, background-color 300ms ${EASE_OUT}, opacity 300ms ${EASE_OUT} 200ms`
        : undefined

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "13px minmax(0, 1fr)",
                alignItems: "center",
                gap: 6,
                height: PILL_HEIGHT,
                boxSizing: "border-box",
                padding: "0 8px 0 9px",
                borderRadius: 999,
                border: `1px ${borderStyle} ${borderColor}`,
                background,
                opacity: slot.dim ? 0.5 : 1,
                transition,
                color: ok ? T.successText : T.secondary,
                minWidth: 0,
            }}
        >
            <Icon name={SLOT_ICONS[index]} />
            <Swap k={slot.value ?? "searching"} enter={filled ? "wipe" : "slide"} style={{ height: 16 }}>
                <span
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12,
                        lineHeight: "16px",
                        fontWeight: filled && !slot.muted ? 500 : 400,
                        color: valueColor,
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                        maxWidth: "100%",
                        transition: animate ? `color 300ms ${EASE_OUT}` : undefined,
                    }}
                >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {filled ? slot.value : `${SLOT_SEARCH_LABELS[index]} · searching…`}
                    </span>
                    {!filled && <Spinner animate={animate} />}
                </span>
            </Swap>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Step rows                                                           */
/* ------------------------------------------------------------------ */

function StepRow({
    row,
    index,
    total,
    exiting,
    animate,
}: {
    row: Row
    index: number
    total: number
    exiting: boolean
    animate: boolean
}) {
    const flashRef = React.useRef<HTMLDivElement>(null)
    const contentRef = React.useRef<HTMLDivElement>(null)

    // 3.5 shake: 100ms after the chip has swapped in (swap-in ends at 260ms).
    React.useEffect(() => {
        const el = contentRef.current
        if (!el || !animate || !row.shake || typeof el.animate !== "function") return
        el.animate(
            [
                { transform: "translateX(0)" },
                { transform: "translateX(-3px)" },
                { transform: "translateX(3px)" },
                { transform: "translateX(-2px)" },
                { transform: "translateX(2px)" },
                { transform: "translateX(0)" },
            ],
            { duration: 400, easing: "ease", delay: 360 }
        )
    }, [row.shake, animate])

    // 3.6 success flash on the layer behind the row content.
    React.useEffect(() => {
        const el = flashRef.current
        if (!el || !animate || !row.flash || typeof el.animate !== "function") return
        el.animate(
            [
                { backgroundColor: "rgba(132,204,22,0)", offset: 0 },
                { backgroundColor: T.flash, offset: 0.25 },
                { backgroundColor: "rgba(132,204,22,0)", offset: 1 },
            ],
            { duration: 1600, easing: "ease-out" }
        )
    }, [row.flash, animate])

    const hidden = !row.visible
    let rowAnim: string | undefined
    let lineAnim: string | undefined
    if (animate && row.visible) {
        if (exiting) {
            const delay = (total - 1 - index) * 60
            rowAnim = `pwcRowOut 250ms ${EASE_OUT} ${delay}ms both`
            lineAnim = `pwcLineOut 250ms ${EASE_OUT} ${delay}ms both`
        } else {
            rowAnim = row.divider
                ? `pwcFadeIn 300ms ${EASE_OUT} both`
                : `pwcRowIn 250ms ${EASE_OUT} ${LINE_LEAD}ms both`
            lineAnim = `pwcLineIn 250ms ${EASE_OUT} both`
        }
    }

    const icon = chipIcon(row.status.text, row.status.tone, row.status.spinner)

    return (
        <div style={{ position: "relative", height: ROW_HEIGHT }}>
            {/* connector line above this row's badge (3.1) */}
            {index > 0 && (
                <span
                    style={{
                        position: "absolute",
                        left: BADGE / 2 - 0.5,
                        top: 0,
                        width: 1,
                        height: row.divider ? "100%" : ROW_HEIGHT / 2 - BADGE / 2,
                        background: T.hairline,
                        transformOrigin: exiting ? "bottom" : "top",
                        transform: hidden ? "scaleY(0)" : undefined,
                        animation: lineAnim,
                    }}
                />
            )}
            {/* flash layer (z 2) */}
            <div ref={flashRef} style={{ position: "absolute", inset: 0, margin: "0 -8px", borderRadius: 6 }} />
            {/* content (z 3) */}
            <div
                ref={contentRef}
                style={{
                    position: "relative",
                    display: "grid",
                    gridTemplateColumns: `${BADGE}px auto minmax(0, 1fr)`,
                    alignItems: "center",
                    columnGap: 10,
                    height: ROW_HEIGHT,
                    opacity: hidden ? 0 : undefined,
                    animation: rowAnim,
                }}
            >
                {row.divider ? (
                    <>
                        <span />
                        <span
                            style={{
                                gridColumn: "2 / span 2",
                                fontSize: 11,
                                lineHeight: "15px",
                                fontWeight: 500,
                                letterSpacing: 0.2,
                                color: T.tertiary,
                            }}
                        >
                            {row.label}
                        </span>
                    </>
                ) : (
                    <>
                        <span
                            style={{
                                width: BADGE,
                                height: BADGE,
                                boxSizing: "border-box",
                                borderRadius: 999,
                                border: `1px solid ${T.hairline}`,
                                background: T.surface,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: T.secondary,
                                overflow: "hidden",
                            }}
                        >
                            {row.domain ? <Logo label={row.label} domain={row.domain} /> : <Icon name="person" size={12} />}
                        </span>
                        <span
                            style={{
                                fontSize: 13,
                                lineHeight: "18px",
                                fontWeight: 500,
                                color: T.ink,
                                whiteSpace: "nowrap",
                            }}
                        >
                            {row.label}
                        </span>
                        <Swap k={row.status.text} style={{ height: 20 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                                <Chip tone={row.status.tone} icon={icon}>
                                    {row.status.text}
                                </Chip>
                                {row.status.spinner && <Spinner animate={animate} />}
                            </span>
                        </Swap>
                    </>
                )}
            </div>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/* Framer property controls                                            */
/* ------------------------------------------------------------------ */

addPropertyControls(PrebWaterfallCard, {
    label: { type: ControlType.String, title: "Label", defaultValue: "" },
    loop: { type: ControlType.Boolean, title: "Loop", defaultValue: true },
})
