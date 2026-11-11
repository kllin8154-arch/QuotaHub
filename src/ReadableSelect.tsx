import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

export type ReadableOption = { value: string; label: string }

type Props = {
  value: string
  options: ReadableOption[]
  onChange: (value: string) => void
  ariaLabel: string
}

export default function ReadableSelect({ value, options, onChange, ariaLabel }: Props) {
  const id = useId().replaceAll(':', '')
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 200, maxHeight: 260 })
  const chosen = options.findIndex(option => option.value === value)
  const current = chosen >= 0 ? chosen : 0

  function show() {
    const element = trigger.current
    if (!element || !options.length) return
    const rect = element.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom - 13
    const above = rect.top - 13
    const upwards = below < 218 && above > below
    const space = upwards ? above : below
    const maxHeight = Math.min(288, Math.max(100, space - 6))
    setPosition({
      top: upwards ? Math.max(8, rect.top - Math.min(options.length * 43 + 10, maxHeight) - 5) : rect.bottom + 5,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: Math.min(rect.width, window.innerWidth - 16),
      maxHeight
    })
    setActive(current)
    setOpen(true)
  }

  function choose(index: number) {
    const option = options[index]
    if (!option) return
    setOpen(false)
    onChange(option.value)
    trigger.current?.focus()
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        show()
      }
      return
    }
    if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false)
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); trigger.current?.focus() }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActive(event.key === 'Home' ? 0 : options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(active)
    }
  }

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false)
    }
    const scroll = (event: Event) => {
      if (event.target instanceof Element && menu.current?.contains(event.target)) return
      setOpen(false)
    }
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const resize = () => setOpen(false)
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', resize)
    window.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', escape)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const element = menu.current?.querySelector<HTMLElement>('[data-index="' + active + '"]')
    element?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  return <>
    <button
      ref={trigger}
      type="button"
      className={'qh-readable-select' + (open ? ' is-open' : '')}
      role="combobox"
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-controls={id + '-options'}
      aria-expanded={open}
      aria-activedescendant={open ? id + '-option-' + active : undefined}
      onClick={() => open ? setOpen(false) : show()}
      onKeyDown={handleKey}
    >
      <span>{options[current]?.label ?? '请选择'}</span>
      <ChevronDown size={18} aria-hidden="true"/>
    </button>
    {open && createPortal(
      <div ref={menu} id={id + '-options'} role="listbox" aria-label={ariaLabel}
        className="qh-readable-options"
        style={{ position: 'fixed', top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}>
        {options.map((option, index) =>
          <div
            key={option.value}
            id={id + '-option-' + index}
            role="option"
            data-index={index}
            aria-selected={value === option.value}
            className={'qh-readable-option' + (active === index ? ' is-active' : '') + (value === option.value ? ' is-selected' : '')}
            onMouseEnter={() => setActive(index)}
            onPointerDown={event => event.preventDefault()}
            onClick={() => choose(index)}
          >
            <span>{option.label}</span>
            {value === option.value && <Check size={16} aria-hidden="true"/>}
          </div>
        )}
      </div>,
      document.body
    )}
  </>
}
