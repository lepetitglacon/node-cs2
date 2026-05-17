const SIZE = 8 // longueur de chaque bâton (px)
const THICKNESS = 2 // épaisseur (px)
const GAP = 5 // espace depuis le centre (px)
const COLOR = '#00ff41'

export const Crosshair = () => (
  <div
    style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: 100,
    }}
  >
    {/* haut */}
    <div
      style={{
        position: 'absolute',
        width: THICKNESS,
        height: SIZE,
        background: COLOR,
        left: -THICKNESS / 2,
        top: -(GAP + SIZE),
      }}
    />
    {/* bas */}
    <div
      style={{
        position: 'absolute',
        width: THICKNESS,
        height: SIZE,
        background: COLOR,
        left: -THICKNESS / 2,
        top: GAP,
      }}
    />
    {/* gauche */}
    <div
      style={{
        position: 'absolute',
        height: THICKNESS,
        width: SIZE,
        background: COLOR,
        top: -THICKNESS / 2,
        left: -(GAP + SIZE),
      }}
    />
    {/* droite */}
    <div
      style={{
        position: 'absolute',
        height: THICKNESS,
        width: SIZE,
        background: COLOR,
        top: -THICKNESS / 2,
        left: GAP,
      }}
    />
  </div>
)
