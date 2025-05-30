import { useEffect, useState } from 'react'
import {
  Row,
  Col,
  Card,
  Avatar,
  Typography,
  Tabs,
  Modal,
  Badge,
  Spin
} from 'antd'
import {
  UserOutlined,
  ShopOutlined,
  TeamOutlined,
  DollarOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { auth, db } from '../../firebase'
import {
  doc,
  getDoc,
  getDocs,
  collection,
  onSnapshot
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

const { Title, Text } = Typography
const { TabPane } = Tabs

export default function AdminDashboard () {
  const [branchNames, setBranchNames] = useState<string[]>([])
  const [tellers, setTellers] = useState<any[]>([])
  const [credits, setCredits] = useState<any[]>([])
  const [sales, setSales] = useState<{ [branch: string]: number }>({})
  const [productCount, setProductCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (user?.uid) {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        const branches = userDoc.data()?.branches || []
        setBranchNames(branches)

        const [tellerSnap, creditSnap, productSnap] = await Promise.all([
          getDocs(collection(db, 'tellers')),
          getDocs(collection(db, 'credits')),
          getDocs(collection(db, 'products'))
        ])

        const tellersArr = tellerSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        setTellers(tellersArr)

        const creditsArr = creditSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        setCredits(creditsArr)

        setProductCount(productSnap.size)

        let branchSales: { [branch: string]: number } = {}
        branches.forEach((b, idx) => {
          branchSales[b] = 1800 + idx * 1000
        })
        setSales(branchSales)
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  const openModal = (item: any) => {
    setSelectedItem(item)
    setModalVisible(true)
  }

  return (
    <div className='p-4'>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <Row align='middle' gutter={16}>
              <Col>
                <Avatar
                  icon={<DollarOutlined />}
                  style={{ backgroundColor: '#4F8EF7' }}
                  size={48}
                />
              </Col>
              <Col>
                <Title level={5}>Sales Today</Title>
                {branchNames.map(branch => (
                  <Text key={branch}>
                    {branch}: R{sales[branch] || 0}
                  </Text>
                ))}
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={12} sm={12} md={12} lg={12}>
          <Card>
            <Row align='middle' gutter={16}>
              <Col>
                <Avatar
                  icon={<ShopOutlined />}
                  style={{ backgroundColor: '#F7B731' }}
                  size={36}
                />
              </Col>
              <Col>
                <Title level={5}>Products</Title>
                <Text>{productCount}</Text>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={12} sm={12} md={12} lg={12}>
          <Card>
            <Row align='middle' gutter={16}>
              <Col>
                <Avatar
                  icon={<TeamOutlined />}
                  style={{ backgroundColor: '#44C2A6' }}
                  size={36}
                />
              </Col>
              <Col>
                <Title level={5}>Tellers</Title>
                <Text>{tellers.length}</Text>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey='1' className='mt-6'>
        <TabPane
          tab={
            <span>
              <UserOutlined /> Today's Sales
            </span>
          }
          key='1'
        >
          {loading ? (
            <Spin />
          ) : (
            tellers.map(teller => (
              <Card
                key={teller.id}
                className='mb-4 hover:shadow-md cursor-pointer'
                onClick={() => openModal({ ...teller, type: 'sale' })}
              >
                <Card.Meta
                  avatar={
                    <Avatar
                      icon={<UserOutlined />}
                      style={{ backgroundColor: '#4F8EF7' }}
                    />
                  }
                  title={teller.name}
                  description={teller.branch || teller.shop || 'Branch'}
                />
              </Card>
            ))
          )}
        </TabPane>

        <TabPane
          tab={
            <span>
              <ExclamationCircleOutlined /> Outstanding Credit
            </span>
          }
          key='2'
        >
          {loading ? (
            <Spin />
          ) : (
            credits.map(credit => (
              <Card
                key={credit.id}
                className='mb-4 hover:shadow-md cursor-pointer'
                onClick={() => openModal({ ...credit, type: 'credit' })}
              >
                <Card.Meta
                  avatar={
                    <Avatar
                      icon={<ExclamationCircleOutlined />}
                      style={{
                        backgroundColor:
                          credit.status === 'Overdue' ? '#D32F2F' : '#FFA726'
                      }}
                    />
                  }
                  title={credit.customer}
                  description={`R${credit.amount} • Due ${credit.dueDate}`}
                />
                <Badge.Ribbon
                  text={credit.status}
                  color={credit.status === 'Overdue' ? 'red' : 'orange'}
                ></Badge.Ribbon>
              </Card>
            ))
          )}
        </TabPane>
      </Tabs>

      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        centered
      >
        {selectedItem && (
          <div className='text-center'>
            <Avatar
              size={64}
              icon={
                selectedItem.type === 'sale' ? (
                  <UserOutlined />
                ) : (
                  <ExclamationCircleOutlined />
                )
              }
              style={{
                backgroundColor:
                  selectedItem.type === 'sale' ? '#4F8EF7' : '#D32F2F'
              }}
            />
            <Title level={4} className='mt-3'>
              {selectedItem.name || selectedItem.customer}
            </Title>
            <Text>
              {selectedItem.type === 'sale'
                ? `Branch: ${selectedItem.branch || selectedItem.shop}`
                : `Amount: R${selectedItem.amount} | Due: ${selectedItem.dueDate}`}
            </Text>
          </div>
        )}
      </Modal>
    </div>
  )
}
