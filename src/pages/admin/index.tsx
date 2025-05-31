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
  where,
  query,
  Timestamp
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TabPane } = Tabs

export default function AdminDashboard () {
  const [branchNames, setBranchNames] = useState<string[]>([])
  const [tellers, setTellers] = useState<any[]>([])
  const [credits, setCredits] = useState<any[]>([])
  const [salesTotals, setSalesTotals] = useState<{ [branch: string]: number }>(
    {}
  )
  const [salesList, setSalesList] = useState<any[]>([])
  const [productCount, setProductCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)

  useEffect(() => {
    setLoading(true) // Ensure loading on mount

    const unsub = onAuthStateChanged(auth, async user => {
      if (!user?.uid) {
        setLoading(false)
        return
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        const branches = userDoc.data()?.branches || []
        setBranchNames(branches)

        const companyName = userDoc.data()?.companyName
        const [tellerSnap, creditSnap, productSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'users'),
              where('userRole', '==', 'teller'),
              where('companyName', '==', companyName)
            )
          ),
          getDocs(
            query(
              collection(db, 'credits'),
              where('companyName', '==', companyName)
            )
          ),
          getDocs(
            query(
              collection(db, 'products'),
              where('companyName', '==', companyName)
            )
          )
        ])

        setTellers(tellerSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setCredits(creditSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setProductCount(productSnap.size)

        // Fetch today's sales
        const todayStart = dayjs().startOf('day').toDate()
        const todayEnd = dayjs().endOf('day').toDate()
        const salesSnap = await getDocs(
          query(
            collection(db, 'sales'),
            where('companyName', '==', companyName),
            where('createdAt', '>=', Timestamp.fromDate(todayStart)),
            where('createdAt', '<=', Timestamp.fromDate(todayEnd))
          )
        )

        let branchSales = {}
        let todaySalesArr = []
        branches.forEach(branch => {
          branchSales[branch] = 0
        })
        salesSnap.forEach(doc => {
          const sale = doc.data()
          const branch = sale.branch || 'Unknown'
          branchSales[branch] = (branchSales[branch] || 0) + (sale.total || 0)
          todaySalesArr.push({ id: doc.id, ...sale })
        })
        setSalesTotals(branchSales)
        setSalesList(todaySalesArr)
      } catch (err) {
        // Log or show error as needed
        console.log(err)
      } finally {
        setLoading(false)
      }
    })
    // Proper cleanup on unmount
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
                <Text>
                  {branchNames
                    .map(branch => `${branch}: R${salesTotals[branch] || 0}`)
                    .join(' | ')}
                </Text>
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
        {/* Today's Sales Tab */}
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
          ) : salesList.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#aaa', marginTop: 24 }}>
              No sales today.
            </div>
          ) : (
            salesList.map(sale => (
              <Card
                key={sale.id}
                className='mb-4 hover:shadow-md cursor-pointer'
                onClick={() => openModal({ ...sale, type: 'sale' })}
              >
                <Card.Meta
                  avatar={
                    <Avatar
                      icon={<UserOutlined />}
                      style={{ backgroundColor: '#4F8EF7' }}
                    />
                  }
                  title={sale.tellerName || sale.tellerId || 'Sale'}
                  description={
                    `Branch: ${sale.branch} | R${sale.total || 0}` +
                    (sale.createdAt && sale.createdAt.seconds
                      ? ` | ${dayjs
                          .unix(sale.createdAt.seconds)
                          .format('YYYY-MM-DD HH:mm')}`
                      : '')
                  }
                />
              </Card>
            ))
          )}
        </TabPane>

        {/* Credits Tab */}
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
          ) : credits.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#aaa', marginTop: 24 }}>
              No credits today.
            </div>
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
                  title={credit.name || credit.customer}
                  description={
                    `R${credit.amountDue || credit.amount} • Due ` +
                    (credit.dueDate && credit.dueDate.seconds
                      ? dayjs.unix(credit.dueDate.seconds).format('YYYY-MM-DD')
                      : credit.dueDate)
                  }
                />
                <Badge.Ribbon
                  text={credit.status || ''}
                  color={credit.status === 'Overdue' ? 'red' : 'orange'}
                ></Badge.Ribbon>
              </Card>
            ))
          )}
        </TabPane>
      </Tabs>

      {/* Details Modal */}
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
              {selectedItem.tellerName ||
                selectedItem.name ||
                selectedItem.customer}
            </Title>
            <Text>
              {selectedItem.type === 'sale'
                ? `Branch: ${
                    selectedItem.branch || selectedItem.shop
                  } | Amount: R${selectedItem.total || 0}`
                : `Amount: R${
                    selectedItem.amountDue || selectedItem.amount
                  } | Due: ${
                    selectedItem.dueDate && selectedItem.dueDate.seconds
                      ? dayjs
                          .unix(selectedItem.dueDate.seconds)
                          .format('YYYY-MM-DD')
                      : selectedItem.dueDate
                  }`}
            </Text>
          </div>
        )}
      </Modal>
    </div>
  )
}
