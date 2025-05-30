import { useEffect, useState } from 'react'
import {
  List,
  Button,
  Drawer,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
  Card,
  Modal,
  Table
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc
} from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { db, auth } from '../../../firebase'
import { useMediaQuery } from 'react-responsive'
import { useOutletContext } from 'react-router-dom'
import type { Admin } from '../../../types/type'

const AdminsPage = () => {
  const { currentUser } = useOutletContext()
  const [saving, setSaving] = useState(false)
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm<Admin>()
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null)
  const isMobile = useMediaQuery({ maxWidth: 767 })
  const [search, setSearch] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      snapshot => {
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...(doc.data() as Admin) }))
          .filter(user => user.userRole === 'admin')
        setAdmins(data)
        setLoading(false)
      },
      err => {
        message.error('Failed to fetch admins')
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', id))
      message.success('Admin deleted')
    } catch (err) {
      message.error('Failed to delete admin')
    }
  }

  const openForm = (record: Admin | null) => {
    if (record) {
      setEditingAdmin(record)
      form.setFieldsValue(record)
    } else {
      setEditingAdmin(null)
      form.resetFields()
    }
    if (isMobile) {
      setDrawerVisible(true)
    } else {
      setModalVisible(true)
    }
  }

  const handleSave = async (values: Admin | any) => {
    setSaving(true)
    console.log(editingAdmin ? 'Updating admin...' : 'Creating admin...')
    try {
      if (editingAdmin) {
        console.log('Update values:', values)
        await updateDoc(doc(db, 'users', editingAdmin.id), {
          ...values,
          userRole: 'admin'
        })
        message.success('Admin updated')
        console.log('Admin updated successfully.')
      } else {
        console.log('Registering admin with:', values.email)
        const cred = await createUserWithEmailAndPassword(
          auth,
          values.email,
          values.password
        )
        console.log('Firebase auth created:', cred.user.uid)
        console.log(currentUser)
        await setDoc(doc(db, 'users', cred.user.uid), {
          ...values,
          userRole: 'admin',
          uid: cred.user.uid,
          companyName: currentUser.companyName,
          branches: currentUser.branches || [],
          beneficiaryName: currentUser.beneficiaryName || '',
          workers: currentUser.workers || 0,
          monthlyTurnover: currentUser.monthlyTurnover || 0
        })
        message.success(`Admin created with temp password: ${values.password}`)
        console.log('Admin Firestore document created.')
      }

      setDrawerVisible(false)
      setModalVisible(false)
    } catch (err) {
      message.error('Error saving admin')
      console.error('Admin save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const filteredAdmins = admins.filter(
    admin =>
      admin.name?.toLowerCase().includes(search.toLowerCase()) ||
      admin.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className='bg-white p-4 rounded-lg shadow-sm'>
      <div className='flex justify-between items-center mb-4'>
        <h2 className='text-xl font-semibold'>Admin Users</h2>
        <Button
          type='primary'
          icon={<PlusOutlined />}
          onClick={() => openForm(null)}
        >
          Add Admin
        </Button>
      </div>

      <Input.Search
        placeholder='Search admin by name or email'
        value={search}
        onChange={e => setSearch(e.target.value)}
        className='mb-4'
        allowClear
      />

      {isMobile ? (
        <Space direction='vertical' style={{ width: '100%' }}>
          {filteredAdmins.map(admin => (
            <Card
              key={admin.id}
              title={admin.name}
              size='small'
              extra={
                <Space>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => openForm(admin)}
                  />
                  <Popconfirm
                    title='Delete admin?'
                    onConfirm={() => handleDelete(admin.id)}
                    okText='Yes'
                    cancelText='No'
                  >
                    <Button icon={<DeleteOutlined />} danger />
                  </Popconfirm>
                </Space>
              }
            >
              <p>Email: {admin.email}</p>
              <p>Phone: {admin.phone}</p>
            </Card>
          ))}
        </Space>
      ) : (
        <Table<Admin>
          columns={[
            { title: 'Name', dataIndex: 'name', key: 'name' },
            { title: 'Email', dataIndex: 'email', key: 'email' },
            { title: 'Phone', dataIndex: 'phone', key: 'phone' },
            {
              title: 'Actions',
              key: 'actions',
              render: (_, record) => (
                <Space>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => openForm(record)}
                  />
                  <Popconfirm
                    title='Delete admin?'
                    onConfirm={() => handleDelete(record.id)}
                    okText='Yes'
                    cancelText='No'
                  >
                    <Button icon={<DeleteOutlined />} danger />
                  </Popconfirm>
                </Space>
              )
            }
          ]}
          dataSource={filteredAdmins}
          rowKey='id'
          loading={loading}
          pagination={{ pageSize: 6 }}
          scroll={{ x: true }}
        />
      )}

      <Drawer
        title={editingAdmin ? 'Edit Admin' : 'Add Admin'}
        open={isMobile && drawerVisible}
        onClose={() => setDrawerVisible(false)}
        placement='bottom'
        height='auto'
      >
        <Form form={form} layout='vertical' onFinish={handleSave}>
          <Form.Item name='name' label='Name' rules={[{ required: true }]}>
            <Input placeholder='John Doe' />
          </Form.Item>
          <Form.Item
            name='email'
            label='Email'
            rules={[{ required: true, type: 'email' }]}
          >
            <Input placeholder='email@example.com' disabled={!!editingAdmin} />
          </Form.Item>
          <Form.Item name='phone' label='Phone'>
            <Input placeholder='+263...' />
          </Form.Item>
          {/* Only show password field when adding a new admin */}
          {!editingAdmin && (
            <Form.Item
              name='password'
              label='Password'
              rules={[{ required: true, message: 'Password is required' }]}
            >
              <Input.Password placeholder='••••••••' />
            </Form.Item>
          )}
          <Form.Item>
            <Button type='primary' htmlType='submit' block loading={saving}>
              {editingAdmin ? 'Update' : 'Create'}
            </Button>
          </Form.Item>
        </Form>
      </Drawer>

      <Modal
        title={editingAdmin ? 'Edit Admin' : 'Add Admin'}
        open={!isMobile && modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout='vertical' onFinish={handleSave}>
          <Form.Item name='name' label='Name' rules={[{ required: true }]}>
            <Input placeholder='John Doe' />
          </Form.Item>
          <Form.Item
            name='email'
            label='Email'
            rules={[{ required: true, type: 'email' }]}
          >
            <Input placeholder='email@example.com' disabled={!!editingAdmin} />
          </Form.Item>
          <Form.Item name='phone' label='Phone'>
            <Input placeholder='+263...' />
          </Form.Item>
          {!editingAdmin && (
            <Form.Item
              name='password'
              label='Password'
              rules={[{ required: true, message: 'Password is required' }]}
            >
              <Input.Password placeholder='••••••••' />
            </Form.Item>
          )}
          <Form.Item>
            <Button type='primary' htmlType='submit' block>
              {editingAdmin ? 'Update' : 'Create'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AdminsPage
