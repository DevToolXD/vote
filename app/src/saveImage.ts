// Saving a chat photo to the phone.
//  - Galaxy app (Capacitor): write it to the app cache and open the share sheet
//    (갤러리에 저장 / 다운로드 / 다른 앱으로 보내기).
//  - iPhone / browsers: the Web Share sheet with the file ("이미지 저장"), or a
//    plain download where sharing files isn't available.

const isNative = () => !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()

export async function saveImage(dataUrl: string) {
  const name = `photo-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}.jpg`
  if (isNative()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    const { uri } = await Filesystem.writeFile({ path: name, data: dataUrl.split(',')[1], directory: Directory.Cache })
    await Share.share({ files: [uri], title: '사진 저장' })
    return 'shared'
  }
  const blob = await (await fetch(dataUrl)).blob()
  const file = new File([blob], name, { type: blob.type || 'image/jpeg' })
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] })
    return 'shared'
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  return 'downloaded'
}
