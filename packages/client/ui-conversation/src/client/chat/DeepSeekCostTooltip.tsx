// Rich hover card for DeepSeek cost figures: a dark bubble with one model
// block, peak/off-peak headings, and per-bucket rows aligned by columns.

import {
  cloneElement, useCallback, useEffect, useRef, useState,
  type FocusEventHandler, type MouseEventHandler, type MutableRefObject,
  type ReactElement, type ReactNode, type Ref,
} from 'react'
import {
  formatRmb, formatTokens, formatUnitPrice,
  type CostFormulaTranslate, type DeepSeekModelDetailLike, type DeepSeekTierDetailLike,
} from './message-chrome.ts'
import css from './DeepSeekCostTooltip.module.css'

interface AnchorProps {
  ref?: Ref<HTMLElement> | undefined
  onMouseEnter?: MouseEventHandler | undefined
  onMouseLeave?: MouseEventHandler | undefined
  onFocus?: FocusEventHandler | undefined
  onBlur?: FocusEventHandler | undefined
}

function BucketRow({
  label, tokens, price, cost,
}: {
  label: string
  tokens: number
  price: number
  cost: number
}) {
  return (
    <div className={css.row}>
      <span className={css.label}>{label}</span>
      <span className={css.formula}>{formatTokens(tokens)} tok × {formatUnitPrice(price)}</span>
      <span className={css.cost}>{formatRmb(cost)}</span>
    </div>
  )
}

function TierBlock({
  title, detail, t,
}: {
  title: string
  detail: DeepSeekTierDetailLike
  t: CostFormulaTranslate
}) {
  const rows: ReactNode[] = []
  if (detail.uncachedInputTokens > 0) {
    rows.push(
      <BucketRow
        key="uncached"
        label={t('stats.deepseekFormulaLabelUncached')}
        tokens={detail.uncachedInputTokens}
        price={detail.uncachedInputPricePerMillion}
        cost={detail.uncachedInputRmb}
      />,
    )
  }
  if (detail.cacheReadTokens > 0) {
    rows.push(
      <BucketRow
        key="cacheRead"
        label={t('stats.deepseekFormulaLabelCacheRead')}
        tokens={detail.cacheReadTokens}
        price={detail.cacheReadPricePerMillion}
        cost={detail.cacheReadRmb}
      />,
    )
  }
  if (detail.cacheWriteTokens > 0) {
    rows.push(
      <BucketRow
        key="cacheWrite"
        label={t('stats.deepseekFormulaLabelCacheWrite')}
        tokens={detail.cacheWriteTokens}
        price={detail.cacheWritePricePerMillion}
        cost={detail.cacheWriteRmb}
      />,
    )
  }
  if (detail.outputTokens > 0) {
    rows.push(
      <BucketRow
        key="output"
        label={t('stats.deepseekFormulaLabelOutput')}
        tokens={detail.outputTokens}
        price={detail.outputPricePerMillion}
        cost={detail.outputRmb}
      />,
    )
  }
  if (rows.length === 0) return null
  return (
    <div className={css.tier}>
      <div className={css.tierTitle}>{title}</div>
      <div className={css.rows}>{rows}</div>
    </div>
  )
}

function CostCard({
  details, t,
}: {
  details: readonly DeepSeekModelDetailLike[]
  t: CostFormulaTranslate
}) {
  return (
    <div className={css.card}>
      {details.map(entry => (
        <div className={css.model} key={entry.model}>
          <div className={css.modelTitle}>{t('stats.deepseekFormulaModel', { model: entry.model })}</div>
          <TierBlock
            title={t('stats.deepseekFormulaPeak')}
            detail={entry.peak}
            t={t}
          />
          <TierBlock
            title={t('stats.deepseekFormulaOffPeak')}
            detail={entry.offPeak}
            t={t}
          />
        </div>
      ))}
    </div>
  )
}

/**
 * Hover/focus bubble for one DeepSeek cost anchor. Renders a styled card
 * rather than plain text; the anchor is the child element itself.
 * @param props.details - per-model peak/off-peak calculation details.
 * @param props.t - locale seat for the model/peak/off-peak labels.
 * @param props.children - the single anchor element (the amount label).
 */
export function DeepSeekCostTooltip({
  details, t, children,
}: {
  details: readonly DeepSeekModelDetailLike[]
  t: CostFormulaTranslate
  children: ReactElement<AnchorProps>
}) {
  const anchor = useRef<HTMLElement | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggers = useRef({ hover: false, focus: false })

  const childRef = (children as ReactElement<AnchorProps> & { ref?: Ref<HTMLElement> }).ref
  const mergedRef = useCallback((el: HTMLElement | null) => {
    anchor.current = el
    if (typeof childRef === 'function') childRef(el)
    else if (childRef != null) (childRef as MutableRefObject<HTMLElement | null>).current = el
  }, [childRef])

  const clearShowTimer = useCallback(() => {
    if (showTimer.current === null) return
    clearTimeout(showTimer.current)
    showTimer.current = null
  }, [])

  const hide = useCallback(() => {
    clearShowTimer()
    triggers.current = { hover: false, focus: false }
    setPos(null)
  }, [clearShowTimer])

  const show = useCallback(() => {
    const el = anchor.current
    if (el === null) return
    const rect = el.getBoundingClientRect()
    setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
  }, [])

  const enter = useCallback(() => {
    triggers.current.hover = true
    clearShowTimer()
    showTimer.current = setTimeout(show, 500)
  }, [clearShowTimer, show])

  const leave = useCallback(() => {
    triggers.current.hover = false
    if (!triggers.current.focus) hide()
  }, [hide])

  const focus = useCallback(() => {
    triggers.current.focus = true
    clearShowTimer()
    show()
  }, [clearShowTimer, show])

  const blur = useCallback(() => {
    triggers.current.focus = false
    if (!triggers.current.hover) hide()
  }, [hide])

  useEffect(() => {
    return () => { clearShowTimer() }
  }, [clearShowTimer])

  const childProps: AnchorProps & { ref: Ref<HTMLElement> } = {
    ref: mergedRef,
    onMouseEnter: enter,
    onMouseLeave: leave,
    onFocus: focus,
    onBlur: blur,
  }

  return (
    <>
      {cloneElement(children, childProps)}
      {pos !== null && (
        <div className={css.bubble} style={{ left: pos.x, top: pos.y }}>
          <CostCard details={details} t={t} />
        </div>
      )}
    </>
  )
}
