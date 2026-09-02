import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { legacyPatchesPlugin } from './build/legacyPatches.js'

export default defineConfig({
  plugins: [legacyPatchesPlugin(), react()],
})
