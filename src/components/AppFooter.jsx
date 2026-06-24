export default function AppFooter() {
  return (
    <footer className="app-footer">
      SIWARGA — Permata Jaya Krian &nbsp;·&nbsp; &copy; {new Date().getFullYear()}{' '}
      <a
        href="https://github.com/NiceGuy99"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'inherit', textDecoration: 'underline' }}
      >
        NiceGuy99
      </a>
    </footer>
  )
}
