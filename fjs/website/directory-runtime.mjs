/** The DOM boundary for the mobile directory catalogue. */

/** @type {(layout: Element | null) => void} */
export const startDirectoryDrawer = layout => {
    if (!layout || layout.hasAttribute('data-drawer-ready')) return
    const catalogue = layout.querySelector('[data-catalogue]')
    const main = layout.querySelector('main')
    if (!catalogue?.children.length || !main) return
    const doc = layout.ownerDocument
    const dialog = doc.createElement('dialog')
    if (typeof dialog.showModal !== 'function') return
    dialog.setAttribute('data-drawer', '')
    dialog.id = 'directory-drawer'
    dialog.setAttribute('aria-labelledby', 'drawer-title')
    const heading = doc.createElement('div')
    heading.setAttribute('data-drawer-top', '')
    const title = doc.createElement('h2')
    title.id = 'drawer-title'
    title.textContent = 'Browse'
    const close = doc.createElement('button')
    close.type = 'button'
    close.textContent = '×'
    close.setAttribute('aria-label', 'Close navigation')
    heading.append(title, close)
    const path = doc.createElement('p')
    path.setAttribute('data-drawer-path', '')
    path.textContent = main.querySelector('h1')?.textContent ?? ''
    dialog.append(heading, path)
    const navigation = doc.createElement('div')
    navigation.setAttribute('data-directory-navigation', '')
    navigation.setAttribute('role', 'group')
    navigation.setAttribute('aria-label', 'Directory navigation')
    for (const label of ['Contents', 'Issues']) {
        const section = Array.from(catalogue.querySelectorAll('details')).find(
            section => section.querySelector('summary')?.textContent === label)
        const button = doc.createElement('button')
        button.type = 'button'
        button.setAttribute('aria-controls', dialog.id)
        button.setAttribute('aria-haspopup', 'dialog')
        button.textContent = label === 'Issues'
            ? `${label} · ${section?.querySelectorAll('li').length ?? 0}`
            : label
        button.disabled = !section
        button.addEventListener('click', () => {
            if (!section) return
            dialog.append(catalogue)
            section.open = true
            dialog.showModal()
            section.scrollIntoView({ block: 'start' })
        })
        navigation.append(button)
    }
    main.prepend(navigation)
    layout.append(dialog)
    close.addEventListener('click', () => dialog.close())
    dialog.addEventListener('click', event => {
        const bounds = dialog.getBoundingClientRect()
        if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right
            || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close()
    })
    dialog.addEventListener('close', () => layout.prepend(catalogue))
    doc.defaultView?.matchMedia('(max-width: 48rem)').addEventListener('change', () => dialog.close())
    layout.setAttribute('data-drawer-ready', '')
}
