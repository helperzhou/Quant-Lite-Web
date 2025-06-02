import {
  Layout,
  Menu,
  Drawer,
  Breadcrumb,
  Avatar,
  Dropdown,
  message,
  Form,
  Input,
  Button,
  Space
} from 'antd'
import {
  MenuOutlined,
  UserOutlined,
  LogoutOutlined,
  HomeOutlined,
  TeamOutlined,
  AppstoreOutlined,
  DollarOutlined,
  CreditCardOutlined,
  EditOutlined,
  MoneyCollectOutlined,
  FileExclamationOutlined,
  ToolOutlined,
  LineChartOutlined
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { auth, db } from '../firebase'
import { updateProfile, updatePassword, updateEmail } from 'firebase/auth'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, updateDoc, getDoc } from 'firebase/firestore'

const { Header, Sider, Content } = Layout

const SystemLayout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [accountDrawer, setAccountDrawer] = useState(false)
  const [companyName, setCompanyName] = useState('Quant Lite')
  const [currentUser, setCurrentUser] = useState(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  const pathname = location.pathname.split('/').filter(Boolean)

  const breadcrumbItems = pathname.map((item, index) => {
    const url = '/' + pathname.slice(0, index + 1).join('/')
    const isLast = index === pathname.length - 1
    return {
      title: isLast ? (
        <span className='text-blue-600 font-semibold'>
          {item.charAt(0).toUpperCase() + item.slice(1)}
        </span>
      ) : (
        <Link to={url} className='text-gray-600'>
          {item.charAt(0).toUpperCase() + item.slice(1)}
        </Link>
      )
    }
  })

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          const data = userDoc.data()
          setCurrentUser({
            uid: user.uid, // important!
            ...userDoc.data()
          })
          if (data.companyName) setCompanyName(data.companyName)
        }
      }
    })
    return () => unsub()
  }, [])

  const handleLogout = () => {
    auth.signOut()
    navigate('/auth/login')
  }

  // --- Menu items based on role ---
  const adminMenuItems = [
    { key: '/admin', icon: <HomeOutlined />, label: 'Home' },
    { key: '/tellers', icon: <MoneyCollectOutlined />, label: 'POS' },
    {
      key: 'users',
      icon: <TeamOutlined />,
      label: 'Users',
      children: [
        { key: '/admin/users/admins', label: 'Admins' },
        { key: '/admin/users/tellers', label: 'Tellers' }
      ]
    },
    {
      key: '/admin/products',
      icon: <AppstoreOutlined />,
      label: 'Products'
    },
    {
      key: '/admin/credits',
      icon: <CreditCardOutlined />,
      label: 'Credits'
    },
    {
      key: '/admin/expenses',
      icon: <FileExclamationOutlined />,
      label: 'Expenses'
    },
    {
      key: '/drawings',
      icon: <ToolOutlined />,
      label: 'Drawings'
    },
    {
      key: '/analytics',
      icon: <LineChartOutlined />,
      label: 'Analytics'
    },
    { key: '/cashin', icon: <DollarOutlined />, label: 'Cashin' }
  ]

  const tellerMenuItems = [
    {
      key: '/tellers',
      icon: <HomeOutlined />,
      label: 'POS'
    },
    {
      key: '/drawings',
      icon: <ToolOutlined />,
      label: 'Drawings'
    },
    {
      key: '/admin/credits',
      icon: <CreditCardOutlined />,
      label: 'Credits'
    }
  ]

  const getMenuItems = () => {
    if (!currentUser) return []
    if (currentUser.userRole === 'teller') return tellerMenuItems
    return adminMenuItems
  }

  // --- Mobile menu generation ---
  // Use expandIcon for nested users
  const mobileMenu = (
    <Menu
      mode='inline'
      onClick={({ key }) => {
        if (key === 'logout') return handleLogout()
        if (key === 'edit') return setAccountDrawer(true)
        // Don't navigate for menu groups/parents
        if (key !== 'users') {
          navigate(key)
          setDrawerVisible(false)
        }
      }}
      items={[
        ...(currentUser?.userRole === 'teller'
          ? [
              { key: '/tellers', icon: <HomeOutlined />, label: 'POS' },
              {
                key: '/drawings',
                icon: <ToolOutlined />,
                label: 'Drawings'
              },
              {
                key: '/admin/credits',
                icon: <CreditCardOutlined />,
                label: 'Credits'
              }
            ]
          : [
              { key: '/admin', icon: <HomeOutlined />, label: 'Home' },
              { key: '/tellers', icon: <MoneyCollectOutlined />, label: 'POS' },
              {
                key: 'users',
                icon: <TeamOutlined />,
                label: 'Users',
                children: [
                  { key: '/admin/users/admins', label: 'Admins' },
                  { key: '/admin/users/tellers', label: 'Tellers' }
                ]
              },
              {
                key: '/admin/products',
                icon: <AppstoreOutlined />,
                label: 'Products'
              },
              {
                key: '/admin/credits',
                icon: <CreditCardOutlined />,
                label: 'Credits'
              },
              {
                key: '/drawings',
                icon: <ToolOutlined />,
                label: 'Drawings'
              },
              {
                key: '/admin/expenses',
                icon: <FileExclamationOutlined />,
                label: 'Expenses'
              },
              {
                key: '/analytics',
                icon: <LineChartOutlined />,
                label: 'Analytics'
              },
              { key: '/cashin', icon: <DollarOutlined />, label: 'Cashin' }
            ])
      ]}
      defaultOpenKeys={['users']} // expand Users by default
      expandIcon={({ isOpen }) => (
        <span style={{ fontSize: 16, marginRight: 8 }}>
          {isOpen ? '^' : '>'}
        </span>
      )}
    />
  )

  // --- Render ---
  return (
    <Layout style={{ minHeight: '100vh', background: '#ffffff' }}>
      {!isMobile && (
        <Sider
          width={220}
          style={{
            background: '#ffffff',
            overflow: 'auto',
            position: 'fixed',
            height: '100vh',
            left: 0,
            boxShadow: '2px 0 6px rgba(0,0,0,0.05)'
          }}
        >
          <div className='text-black text-center font-bold text-xl py-6'>
            Quant Lite
          </div>
          <Menu
            theme='light'
            mode='inline'
            defaultSelectedKeys={[location.pathname]}
            onClick={({ key }) => navigate(key)}
            items={getMenuItems()}
          />
        </Sider>
      )}

      <Layout style={{ marginLeft: isMobile ? 0 : 220, background: '#ffffff' }}>
        <Header
          className='px-4 flex items-center justify-between sticky top-0 z-50'
          style={{
            background: '#ffffff',
            color: 'black',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          <div className={isMobile ? 'block' : 'hidden'}>
            <Button
              icon={<MenuOutlined />}
              type='text'
              onClick={() => setDrawerVisible(true)}
            />
          </div>

          <div className='hidden lg:flex flex-1'>
            <Breadcrumb items={breadcrumbItems} />
          </div>

          <div className='text-center flex-1 font-bold text-blue-600 text-lg'>
            {companyName}
          </div>

          <div className='flex justify-end flex-1'>
            <Dropdown
              overlay={
                <Menu>
                  <Menu.Item
                    key='edit'
                    icon={<EditOutlined />}
                    onClick={() => setAccountDrawer(true)}
                  >
                    Edit Account
                  </Menu.Item>
                  <Menu.Item
                    key='logout'
                    icon={<LogoutOutlined />}
                    onClick={handleLogout}
                  >
                    Logout
                  </Menu.Item>
                </Menu>
              }
              placement='bottomRight'
            >
              <Avatar className='cursor-pointer' icon={<UserOutlined />} />
            </Dropdown>
          </div>
        </Header>

        <Content
          className='p-4'
          style={{
            overflowY: 'auto',
            minHeight: 'calc(100vh - 64px)',
            background: '#f5f5f5'
          }}
        >
          <Outlet context={{ currentUser }} />
        </Content>
      </Layout>

      <Drawer
        title='Menu'
        placement='left'
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        className='lg:hidden'
        bodyStyle={{ padding: 0 }}
      >
        {mobileMenu}
      </Drawer>

      <Drawer
        title='Edit Account'
        placement={isMobile ? 'bottom' : 'right'}
        open={accountDrawer}
        onClose={() => setAccountDrawer(false)}
      >
        <EditAccountForm
          currentUser={currentUser}
          auth={auth}
          db={db}
          onClose={() => setAccountDrawer(false)}
        />
      </Drawer>
    </Layout>
  )
}

function EditAccountForm ({ currentUser, auth, db, onClose }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    form.setFieldsValue({
      name: currentUser.name || '',
      userEmail: currentUser.userEmail || '',
      phone: currentUser.phone || ''
    })
  }, [currentUser, form])

  const handleFinish = async values => {
    setLoading(true)
    try {
      // Update profile fields in Firestore
      if (currentUser?.uid) {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          name: values.name,
          phone: values.phone
        })
      }

      // Optionally: update password if changed
      if (values.password) {
        await updatePassword(auth.currentUser, values.password)
      }

      message.success('Account updated successfully!')
      onClose()
    } catch (e: any) {
      message.error(
        e.message.includes('auth/requires-recent-login')
          ? 'Please log in again to change sensitive information.'
          : e.message || 'Could not update account.'
      )
    }
    setLoading(false)
  }

  return (
    <Form
      form={form}
      layout='vertical'
      onFinish={handleFinish}
      style={{ marginTop: 8 }}
      initialValues={{}}
    >
      <Form.Item
        name='name'
        label='Name'
        rules={[{ required: true, message: 'Name is required' }]}
      >
        <Input placeholder='Enter your name' />
      </Form.Item>
      <Form.Item
        name='userEmail'
        label='Email'
        rules={[
          { required: true, message: 'Email is required' },
          { type: 'email', message: 'Invalid email' }
        ]}
      >
        <Input disabled placeholder='Email (not editable)' />
      </Form.Item>
      <Form.Item
        name='phone'
        label='Phone Number'
        rules={[
          { required: true, message: 'Phone number is required' },
          { pattern: /^[0-9+\-\s]+$/, message: 'Invalid phone number' }
        ]}
      >
        <Input placeholder='Enter phone number' />
      </Form.Item>
      <Form.Item
        name='password'
        label='New Password'
        extra='Leave blank to keep current password'
      >
        <Input.Password placeholder='Enter new password (optional)' />
      </Form.Item>
      <Space>
        <Button onClick={onClose}>Cancel</Button>
        <Button type='primary' htmlType='submit' loading={loading}>
          Save Changes
        </Button>
      </Space>
    </Form>
  )
}

export default SystemLayout
