import styles from '@/styles/Home.module.css'
import { sanitizeTokenId } from '@/utils/utils'

interface TokenSearchProps {
  tokenId: string
  isLoading: boolean
  hasTokenInfo: boolean
  onTokenIdChange: (tokenId: string) => void
  onSearch: () => void
}

export function TokenSearch({
  tokenId,
  isLoading,
  hasTokenInfo,
  onTokenIdChange,
  onSearch
}: TokenSearchProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTokenId = sanitizeTokenId(e.target.value)
    onTokenIdChange(newTokenId)

    const url = new URL(window.location.href)
    const params = new URLSearchParams(url.search)
    params.set("tokenId", newTokenId)
    window.history.replaceState({}, "", `${location.pathname}?${params}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch()
    }
  }

  return (
    <div className={styles.searchWrap}>
      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          type="text"
          id="tokenId"
          placeholder="Enter a Token ID (Category ID)…"
          value={tokenId}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          className={styles.searchButton}
          onClick={onSearch}
          disabled={isLoading && !hasTokenInfo}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Explore</span>
        </button>
      </div>
      {isLoading && !hasTokenInfo && (
        <div className={styles.inlineLoading}>
          <span className={styles.spinner} />
          Loading token info…
        </div>
      )}
    </div>
  )
}
