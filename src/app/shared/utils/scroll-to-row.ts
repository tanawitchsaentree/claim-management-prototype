/** Scroll the element tagged with the given attribute value into the middle of the page, once it has rendered. */
export function scrollToRow(id: string, attr = 'data-row-id'): void {
  setTimeout(() => {
    const row = Array.from(document.querySelectorAll(`[${attr}]`)).find(
      el => el.getAttribute(attr) === id
    );
    row?.scrollIntoView({ block: 'center' });
  }, 200);
}
