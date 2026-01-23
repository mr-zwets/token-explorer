import styles from '@/styles/Home.module.css'

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
    const newTokenId = e.target.value
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
    <>
      <h2 className={styles.description}>Enter tokenId: </h2>
      <input
        className={styles.description}
        style={{ width: "80vw", maxWidth: "570px", padding: "10px 20px" }}
        type="text"
        id="tokenId"
        value={tokenId}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      {isLoading && !hasTokenInfo && (
        <div className={styles.description} style={{ marginTop: "20px" }}>
          loading on-chain tokenInfo...
        </div>
      )}
    </>
  )
}
