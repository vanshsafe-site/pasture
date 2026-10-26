import { useState } from 'react'
import { changeDemo, createDemo, DEMO_STORAGE_KEY, loadDemo } from './demo'

export function useDemoFarm(enabled) {
  const [error,setError]=useState('')
  const [store,setStore]=useState(()=>{
    if(!enabled)return null
    try{return loadDemo(localStorage)}catch{return createDemo()}
  })
  function reload() {
    if(!enabled)return
    try{setStore(loadDemo(localStorage));setError('')}catch(err){setError(err.message)}
  }
  function persist(next) {
    try{localStorage.setItem(DEMO_STORAGE_KEY,JSON.stringify(next))}
    catch{throw new Error('The browser could not save demo changes. Allow local storage or free some space, then retry.')}
    setStore(next);setError('')
  }
  async function mutate(table,action,values,previous) {
    // Read the latest browser state so two tabs do not silently overwrite a record.
    const latest=loadDemo(localStorage)
    persist(changeDemo(latest,table,action,values,previous))
  }
  function reset(){persist(createDemo())}
  return {data:store?.data,profile:store?.profile,settings:store?.settings,loading:false,busy:false,error,reload,mutate,reset}
}
