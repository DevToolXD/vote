import { css } from '../css'

// 공룡 점프: the open-source T-Rex Runner (wayou/t-rex-runner, BSD-3-Clause), a copy of the
// offline dino game Chrome shows without a connection. It lives unchanged in public/dino (see the
// LICENSE there). It runs on its own page, so its keyboard and touch listeners and globals end
// with the app instead of leaking into it.
// The page was laid out for a desktop tab, so its game band sits near the top of the page. The frame
// is moved up so that band (about 35 to 185 px down the page) is in the middle of the screen.
export function DinoGame() {
  return (
    <div style={css('position:relative;width:100%;height:100%;overflow:hidden;background:#ffffff')}>
      <iframe src={`${import.meta.env.BASE_URL}dino/index.html`} title="공룡 점프" style={css('position:absolute;left:0;top:calc(50% - 110px);width:100%;height:100%;border:0;background:#ffffff')} />
    </div>
  )
}
