import { useCallback, useState } from "react"

type Options = {
  initialPaths?: string[]
}

export function usePhotoList(options: Options = {}) {
  const { initialPaths = [] } = options
  const [paths, setPaths] = useState<string[]>(initialPaths)

  const reset = useCallback(() => {
    setPaths([])
  }, [])

  return {
    paths,
    setPaths,
    reset,
  }
}

