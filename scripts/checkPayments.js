async function run(){
  try{
    const base = process.env.API_BASE || 'http://localhost:3000'
    console.log('Checking endpoints on', base)
    const r1 = await fetch(`${base}/api/payments/by-factura/1`)
    console.log('/api/payments/by-factura/1 ->', r1.status)
    const r2 = await fetch(`${base}/api/payments/1`)
    console.log('/api/payments/1 ->', r2.status)
    process.exit(0)
  }catch(e){
    console.error('Error', e)
    process.exit(2)
  }
}

run()
