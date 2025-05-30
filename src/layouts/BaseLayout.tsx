import { message } from 'antd'
import type { ReactNode } from 'react'

const BaseLayout = ({ children }: { children: ReactNode }) => {
  const [messageApi, contextHolder] = message.useMessage()

  return (
    <>
      {contextHolder}
      <main className='min-h-screen bg-white'>{children}</main>
    </>
  )
}

export default BaseLayout
