import { describe, it, expect, vi } from 'vitest'
import { payphoneService } from './payphoneService'
import * as httpClient from './httpClient'

describe('payphoneService', () => {
  it('calls backend create intent', async () => {
    const mock = { payment: { id_payment: 1, amount: 10, status: 'PENDING' }, intent: { paymentUrl: 'https://pay' } }
    vi.spyOn(httpClient, 'httpRequest').mockResolvedValue(mock as unknown)

    const res = await payphoneService.createIntent({ id_factura: 1, amount: 10 })
    expect(res).toEqual(mock)
  })
})
