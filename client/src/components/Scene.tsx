import {
  Engine,
  Scene,
  type EngineOptions,
  type SceneOptions,
  FreeCamera,
  Vector3,
  HemisphericLight,
  MeshBuilder,
  Mesh,
} from '@babylonjs/core'
import { type FC, useEffect, useRef } from 'react'

// import SceneComponent from 'babylonjs-hook'; // if you install 'babylonjs-hook' NPM.

type SceneComponentProps = {
  canvasId: string
  antialias?: boolean
  engineOptions?: EngineOptions
  adaptToDeviceRatio?: boolean
  sceneOptions?: SceneOptions
  onRender: OnRenderHandler
  onSceneReady: OnSceneReadyHandler
}

const SceneComponent: FC<SceneComponentProps> = (props) => {
  const reactCanvas = useRef(null)

  const {
    canvasId,
    antialias,
    engineOptions,
    adaptToDeviceRatio,
    sceneOptions,
    onRender,
    onSceneReady,
    ...rest
  } = props

  useEffect(() => {
    if (!reactCanvas.current) return
    const engine = new Engine(
      reactCanvas.current,
      antialias,
      engineOptions,
      adaptToDeviceRatio
    )
    const scene = new Scene(engine, sceneOptions)
    if (scene.isReady()) {
      onSceneReady(scene)
    } else {
      scene.onReadyObservable.addOnce(onSceneReady)
    }

    engine.runRenderLoop(() => {
      onRender(scene)
      scene.render()
    })

    const resize = () => {
      scene.getEngine().resize()
    }

    if (window) {
      window.addEventListener('resize', resize)
    }

    return () => {
      scene.getEngine().dispose()

      if (window) {
        window.removeEventListener('resize', resize)
      }
    }
  }, [
    antialias,
    engineOptions,
    adaptToDeviceRatio,
    sceneOptions,
    onRender,
    onSceneReady,
  ])

  return (
    <canvas
      id={canvasId}
      ref={reactCanvas}
      {...rest}
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
export { SceneComponent }
