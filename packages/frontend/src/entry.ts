import { Runtime } from 'foldkit'
import { startMcpPlugins } from './mcp-plugins'

import {
  Message,
  Model,
  init,
  managedResources,
  subscriptions,
  update,
  view,
} from './main'

const application = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  subscriptions,
  managedResources,
  container: document.getElementById('root'),
  devTools: {
    Message,
  },
})

// The Foldkit runtime is long-lived; initialize optional plugin observers first.
// This has no visible effect when VITE_MCP_PLUGINS_URL is not configured.
startMcpPlugins(import.meta.env.VITE_MCP_PLUGINS_URL)
Runtime.run(application)
