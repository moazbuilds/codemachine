/** @jsxImportSource solid-js */
import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper"

export const { use: useSession, provider: SessionProvider } = createSimpleContext({
  name: "Session",
  init: () => {
    const [store, setStore] = createStore({
      templateName: "default",
      workflowCount: 0,
      lastRun: null as Date | null,
    })

    return {
      get templateName() {
        return store.templateName
      },
      get workflowCount() {
        return store.workflowCount
      },
      get lastRun() {
        return store.lastRun
      },
      updateTemplate(name: string) {
        setStore("templateName", name)
      },
      updateWorkflowCount(count: number) {
        setStore("workflowCount", count)
      },
      updateLastRun(date: Date) {
        setStore("lastRun", date)
      },
    }
  },
})
