import {
  Layout,
  Menu,
  Drawer,
  Breadcrumb,
  Avatar,
  Dropdown,
  Button
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
  EditOutlined
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { auth, db } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

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
    auth.signOut() // Recommended: sign the user out from Firebase
    navigate('/auth/login')
  }

  // --- Menu items based on role ---
  const adminMenuItems = [
    { key: '/admin', icon: <HomeOutlined />, label: 'Home' },
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
    { key: '/cashin', icon: <DollarOutlined />, label: 'Cashin' }
  ]

  // Teller gets only POS (change route to your POS) and Credits
  const tellerMenuItems = [
    {
      key: '/tellers',
      icon: <HomeOutlined />,
      label: 'POS'
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
    // Default to admin menu for everything else
    return adminMenuItems
  }

  // --- Mobile menu generation ---
  const mobileMenu = (
    <Menu
      onClick={({ key }) => {
        if (key === 'logout') return handleLogout()
        if (key === 'edit') return setAccountDrawer(true)
        navigate(key)
        setDrawerVisible(false)
      }}
      items={[
        ...(currentUser?.userRole === 'teller'
          ? [
              { key: '/tellers', icon: <HomeOutlined />, label: 'POS' },
              {
                key: '/admin/credits',
                icon: <CreditCardOutlined />,
                label: 'Credits'
              }
            ]
          : [
              { key: '/admin', icon: <HomeOutlined />, label: 'Home' },
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
              { key: '/cashin', icon: <DollarOutlined />, label: 'Cashin' }
            ])
      ]}
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
      >
        {mobileMenu}
      </Drawer>

      <Drawer
        title='Edit Account'
        placement={isMobile ? 'bottom' : 'right'}
        open={accountDrawer}
        onClose={() => setAccountDrawer(false)}
      >
        <p>Account editing form goes here</p>
      </Drawer>
    </Layout>
  )
}

export default SystemLayout
