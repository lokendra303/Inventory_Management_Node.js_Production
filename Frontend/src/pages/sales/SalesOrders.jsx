import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  DatePicker,
} from "antd";
import { PlusOutlined, DownloadOutlined, PrinterOutlined, MailOutlined, SearchOutlined } from "@ant-design/icons";
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatPrice } from '../../utils/currency';

const SalesOrders = () => {
  const { currency } = useCurrency();
  const [sos, setSOs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedSOForView, setSelectedSOForView] = useState(null);
  const [allItemStocks, setAllItemStocks] = useState({});
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [selectedSOForEmail, setSelectedSOForEmail] = useState(null);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [selectedSOForCancel, setSelectedSOForCancel] = useState(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);

  const fetchAllStocks = async () => {
    try {
      const response = await apiService.get("/inventory");
      if (response.success) {
        const stockByItemAndWarehouse = {};
        response.data.forEach((inv) => {
          if (!stockByItemAndWarehouse[inv.item_id]) {
            stockByItemAndWarehouse[inv.item_id] = {};
          }
          stockByItemAndWarehouse[inv.item_id][inv.warehouse_id] =
            inv.quantity_available || 0;
        });
        setAllItemStocks(stockByItemAndWarehouse);
        console.log("Stock data loaded:", stockByItemAndWarehouse);
      }
    } catch (error) {
      console.error("Failed to fetch stock", error);
    }
  };

  const columns = [
    { title: "SO Number", dataIndex: "so_number", key: "so_number" },
    { title: "Customer", dataIndex: "customer_name", key: "customer_name" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        const colors = {
          draft: "gray",
          confirmed: "blue",
          shipped: "green",
          delivered: "green",
          cancelled: "red",
        };
        return (
          <span style={{ color: colors[status] || "black" }}>
            {status?.toUpperCase()}
          </span>
        );
      },
    },
    {
      title: "Total",
      dataIndex: "total_amount",
      key: "total_amount",
      render: (val, record) =>
        formatPrice(val, currency, record.currency || "USD"),
    },
    { title: "Order Date", dataIndex: "order_date", key: "order_date" },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => viewSO(record)}>
            View
          </Button>
          {record.status === "draft" && (
            <Button
              size="small"
              type="primary"
              onClick={() => confirmSO(record)}
            >
              Confirm
            </Button>
          )}
          {record.status === "confirmed" && (
            <Button size="small" onClick={() => shipSO(record)}>
              Ship
            </Button>
          )}
          {record.status === "draft" && (
            <Button size="small" danger onClick={() => cancelSO(record)}>
              Cancel
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sosRes, customersRes, warehousesRes, itemsRes] = await Promise.all(
        [
          apiService
            .get("/sales-orders")
            .catch(() => ({ success: false, data: [] })),
          apiService
            .get("/customers")
            .catch(() => ({ success: false, data: [] })),
          apiService.get("/warehouses"),
          apiService.get("/items"),
        ],
      );

      setSOs(sosRes.success ? sosRes.data : []);
      setCustomers(customersRes.success ? customersRes.data : []);
      setWarehouses(warehousesRes.success ? warehousesRes.data : []);
      setItems(itemsRes.success ? itemsRes.data : []);
    } catch (error) {
      message.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSO = async (values) => {
    try {
      // Get selected customer details
      const selectedCustomer = customers.find(
        (c) => c.id === values.customerId,
      );

      const soData = {
        ...values,
        customerName:
          selectedCustomer?.display_name ||
          selectedCustomer?.company_name ||
          "Unknown Customer",
        orderDate: values.orderDate ? values.orderDate.format("YYYY-MM-DD") : new Date().toISOString().split('T')[0],
        expectedShipDate: values.expectedShipDate?.format("YYYY-MM-DD") || null,
        lines: (values.lines || []).map(line => ({
          ...line,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice)
        })),
      };

      const response = await apiService.post("/sales-orders", soData);

      if (response.success) {
        message.success("Sales order created successfully");
        setModalVisible(false);
        form.resetFields();
        fetchData();
      }
    } catch (error) {
      const errorMsg =
        error.response?.data?.error ||
        error.message ||
        "Failed to create sales order";
      message.error(errorMsg);
    }
  };

  const confirmSO = async (so) => {
    try {
      const response = await apiService.put(`/sales-orders/${so.id}/status`, {
        status: "confirmed",
      });
      
      if (response.success && response.data?.invoiceNumber) {
        message.success(`Sales order confirmed and invoice ${response.data.invoiceNumber} generated`);
      } else {
        message.success("Sales order confirmed");
      }
      
      fetchData();
    } catch (error) {
      message.error(error.response?.data?.error || "Failed to confirm sales order");
    }
  };

  const shipSO = async (so) => {
    try {
      await apiService.put(`/sales-orders/${so.id}/status`, {
        status: "shipped",
      });
      message.success("Sales order shipped");
      fetchData();
    } catch (error) {
      message.error("Failed to ship sales order");
    }
  };

  const cancelSO = (so) => {
    setSelectedSOForCancel(so);
    setCancellationReason('');
    setCancelModalVisible(true);
  };

  const handleCancelSO = async () => {
    if (!cancellationReason || cancellationReason.trim() === '') {
      message.warning('Please provide a cancellation reason');
      return;
    }

    try {
      const response = await apiService.post(
        `/sales-orders/${selectedSOForCancel.id}/cancel`,
        { cancellationReason: cancellationReason.trim() }
      );

      if (response.success) {
        message.success('Sales order cancelled and reserved stock released');
        setCancelModalVisible(false);
        fetchData();
      }
    } catch (error) {
      message.error(
        error.response?.data?.error || 'Failed to cancel sales order'
      );
    }
  };

  const viewSO = async (so) => {
    try {
      const response = await apiService.get(`/sales-orders/${so.id}`);
      if (response.success) {
        setSelectedSOForView(response.data);
        setViewModalVisible(true);
      }
    } catch (error) {
      message.error("Failed to load SO details");
    }
  };

  const downloadPDF = async (so) => {
    try {
      const token = sessionStorage.getItem('token');
      let institutionId = sessionStorage.getItem('institutionId');
      
      if (!institutionId && token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          institutionId = payload.institutionId;
        } catch (e) {
          console.error('Failed to parse token');
        }
      }
      
      const response = await fetch(`${apiService.baseURL}/sales-orders/${so.id}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-institution-id': institutionId
        }
      });
      
      if (!response.ok) throw new Error('Failed to download PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SO_${so.so_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('PDF downloaded successfully');
    } catch (error) {
      message.error('Failed to download PDF');
    }
  };

  const printSO = async (so) => {
    try {
      const token = sessionStorage.getItem('token');
      let institutionId = sessionStorage.getItem('institutionId');
      
      if (!institutionId && token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          institutionId = payload.institutionId;
        } catch (e) {
          console.error('Failed to parse token');
        }
      }
      
      const response = await fetch(`${apiService.baseURL}/sales-orders/${so.id}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-institution-id': institutionId
        }
      });
      
      if (!response.ok) throw new Error('Failed to load PDF');
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const printWindow = window.open(blobUrl, '_blank');
      if (!printWindow) {
        message.error('Please allow pop-ups to print');
        URL.revokeObjectURL(blobUrl);
        return;
      }
      
      printWindow.onload = function() {
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };
    } catch (error) {
      console.error('Print error:', error);
      message.error('Failed to print PDF');
    }
  };

  const handleEmailSO = (so) => {
    setSelectedSOForEmail(so);
    setEmailAddress('');
    setEmailModalVisible(true);
  };

  const handleSendEmail = async () => {
    if (!emailAddress) {
      message.warning('Please enter an email address');
      return;
    }

    try {
      const response = await apiService.post(`/sales-orders/${selectedSOForEmail.id}/email`, {
        to: emailAddress
      });

      if (response.success) {
        message.success(`Sales order sent to ${emailAddress}`);
        setEmailModalVisible(false);
      } else {
        message.error(response.error || 'Failed to send email');
      }
    } catch (error) {
      message.error('Failed to send email');
    }
  };

  useEffect(() => {
    fetchData();
    fetchAllStocks();
  }, []);

  return (
    <div style={{ padding: "24px" }}>
      <h1>Sales Orders</h1>
      <Card>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            Create SO
          </Button>
          <Input
            placeholder="Search by SO number or customer..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <DatePicker
            placeholder="From Date"
            value={fromDate}
            onChange={date => setFromDate(date)}
            style={{ width: 150 }}
            allowClear
          />
          <DatePicker
            placeholder="To Date"
            value={toDate}
            onChange={date => setToDate(date)}
            style={{ width: 150 }}
            allowClear
          />
          <Select
            placeholder="All Statuses"
            value={statusFilter}
            onChange={val => setStatusFilter(val)}
            style={{ width: 160 }}
            allowClear
          >
            <Select.Option value="draft">Draft</Select.Option>
            <Select.Option value="confirmed">Confirmed</Select.Option>
            <Select.Option value="shipped">Shipped</Select.Option>
            <Select.Option value="delivered">Delivered</Select.Option>
            <Select.Option value="cancelled">Cancelled</Select.Option>
          </Select>
        </Space>
        <Table
          columns={columns}
          dataSource={sos.filter(so => {
            const textMatch = !searchText ||
              so.so_number?.toLowerCase().includes(searchText.toLowerCase()) ||
              so.customer_name?.toLowerCase().includes(searchText.toLowerCase());
            const dateMatch = (!fromDate || !toDate) || (() => {
              const d = new Date(so.order_date);
              return d >= fromDate.startOf('day').toDate() && d <= toDate.endOf('day').toDate();
            })();
            const statusMatch = !statusFilter || so.status === statusFilter;
            return textMatch && dateMatch && statusMatch;
          })}
          loading={loading}
          rowKey="id"
        />
      </Card>

      <Modal
        title="Create Sales Order"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateSO}>
          <Form.Item
            name="soNumber"
            label="SO Number"
            rules={[{ required: true }]}
          >
            <Input placeholder="Enter SO number" />
          </Form.Item>

          <Form.Item
            name="customerId"
            label="Customer"
            rules={[{ required: true }]}
          >
            <Select
              placeholder="Select customer"
              showSearch
              optionFilterProp="children"
            >
              {customers
                .filter((customer) => customer.status === "active")
                .map((customer) => (
                  <Select.Option key={customer.id} value={customer.id}>
                    {customer.display_name}{" "}
                    {customer.company_name && `- ${customer.company_name}`}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item name="currency" label="Currency" initialValue="USD">
            <Select placeholder="Select currency">
              <Select.Option value="USD">USD</Select.Option>
              <Select.Option value="EUR">EUR</Select.Option>
              <Select.Option value="GBP">GBP</Select.Option>
              <Select.Option value="INR">INR</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="channel" label="Sales Channel" initialValue="direct">
            <Select placeholder="Select channel">
              <Select.Option value="direct">Direct</Select.Option>
              <Select.Option value="online">Online</Select.Option>
              <Select.Option value="retail">Retail</Select.Option>
              <Select.Option value="wholesale">Wholesale</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="orderDate"
            label="Order Date"
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="expectedShipDate" label="Expected Ship Date">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => {
                  const selectedItemId = form.getFieldValue([
                    "lines",
                    name,
                    "itemId",
                  ]);
                  const selectedWarehouseId = form.getFieldValue([
                    "lines",
                    name,
                    "warehouseId",
                  ]);
                  const allLines = form.getFieldValue("lines") || [];

                  // Calculate already allocated quantities per item-warehouse combination
                  const allocatedStock = {};
                  allLines.forEach((line, idx) => {
                    if (
                      idx !== name &&
                      line?.itemId &&
                      line?.warehouseId &&
                      line?.quantity
                    ) {
                      const key = `${line.itemId}_${line.warehouseId}`;
                      allocatedStock[key] =
                        (allocatedStock[key] || 0) + line.quantity;
                    }
                  });

                  // Filter warehouses that have the selected item in stock (after allocation)
                  const availableWarehouses = selectedItemId
                    ? warehouses.filter((wh) => {
                        const totalStock =
                          allItemStocks[selectedItemId]?.[wh.id] || 0;
                        const allocated =
                          allocatedStock[`${selectedItemId}_${wh.id}`] || 0;
                        const available = totalStock - allocated;
                        return wh.status === "active" && available > 0;
                      })
                    : warehouses.filter((wh) => wh.status === "active");

                  // Filter items that are available in the selected warehouse (after allocation)
                  const availableItems = selectedWarehouseId
                    ? items.filter((item) => {
                        const totalStock =
                          allItemStocks[item.id]?.[selectedWarehouseId] || 0;
                        const allocated =
                          allocatedStock[`${item.id}_${selectedWarehouseId}`] ||
                          0;
                        const available = totalStock - allocated;
                        return item.status === "active" && available > 0;
                      })
                    : items.filter((item) => item.status === "active");

                  // Calculate available stock for current selection
                  const currentTotalStock =
                    selectedItemId && selectedWarehouseId
                      ? allItemStocks[selectedItemId]?.[selectedWarehouseId] ||
                        0
                      : 0;
                  const currentAllocated =
                    selectedItemId && selectedWarehouseId
                      ? allocatedStock[
                          `${selectedItemId}_${selectedWarehouseId}`
                        ] || 0
                      : 0;
                  const currentAvailable = currentTotalStock - currentAllocated;

                  return (
                    <div
                      key={key}
                      style={{
                        marginBottom: 16,
                        padding: 16,
                        border: "1px solid #d9d9d9",
                        borderRadius: 4,
                        backgroundColor: "#fafafa",
                      }}
                    >
                      <Space
                        direction="vertical"
                        style={{ width: "100%" }}
                        size="small"
                      >
                        <Space
                          align="start"
                          style={{ width: "100%", flexWrap: "wrap" }}
                        >
                          <Form.Item
                            {...restField}
                            name={[name, "itemId"]}
                            label="Item"
                            rules={[{ required: true, message: "Select item" }]}
                            style={{ marginBottom: 0, minWidth: 250, flex: 1 }}
                          >
                            <Select
                              placeholder="Select item"
                              showSearch
                              optionLabelProp="label"
                              filterOption={(input, option) => {
                                const label = option.label || '';
                                return label.toLowerCase().includes(input.toLowerCase());
                              }}
                              dropdownStyle={{ minWidth: 350 }}
                              onChange={(itemId) => {
                                const selectedItem = items.find(
                                  (i) => i.id === itemId,
                                );
                                if (selectedItem) {
                                  const lines =
                                    form.getFieldValue("lines") || [];
                                  lines[name] = {
                                    ...lines[name],
                                    unitPrice: selectedItem.selling_price || 0,
                                  };
                                  form.setFieldsValue({ lines });
                                }
                              }}
                            >
                              {availableItems.map((item) => {
                                let available = 0;

                                if (selectedWarehouseId) {
                                  const totalStock =
                                    allItemStocks[item.id]?.[
                                      selectedWarehouseId
                                    ] || 0;
                                  const allocated =
                                    allocatedStock[
                                      `${item.id}_${selectedWarehouseId}`
                                    ] || 0;
                                  available = totalStock - allocated;
                                } else {
                                  // Show total across all warehouses
                                  const totalStock = Object.values(
                                    allItemStocks[item.id] || {},
                                  ).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
                                  const allocated = Object.keys(
                                    allItemStocks[item.id] || {},
                                  ).reduce((sum, whId) => {
                                    return (
                                      sum +
                                      (allocatedStock[`${item.id}_${whId}`] ||
                                        0)
                                    );
                                  }, 0);
                                  available = totalStock - allocated;
                                }

                                return (
                                  <Select.Option
                                    key={item.id}
                                    value={item.id}
                                    label={`${item.name} (${item.sku})`}
                                  >
                                    <div>
                                      <strong>{item.name}</strong> ({item.sku})
                                      <br />
                                      <span
                                        style={{
                                          fontSize: "12px",
                                          color: available > 0 ? "#52c41a" : "#ff4d4f",
                                        }}
                                      >
                                        Available: {available}{" "}
                                        {!selectedWarehouseId &&
                                          "(all warehouses)"}
                                      </span>
                                    </div>
                                  </Select.Option>
                                );
                              })}
                            </Select>
                          </Form.Item>

                          <Form.Item
                            {...restField}
                            name={[name, "warehouseId"]}
                            label="Warehouse"
                            rules={[
                              { required: true, message: "Select warehouse" },
                            ]}
                            style={{ marginBottom: 0, minWidth: 250, flex: 1 }}
                          >
                            <Select
                              placeholder="Select warehouse"
                              showSearch
                              optionLabelProp="label" // ✅ important
                              optionFilterProp="label" // ✅ important
                              dropdownStyle={{ minWidth: 300 }}
                            >
                              {availableWarehouses.map((wh) => {
                                const totalStock =
                                  allItemStocks[selectedItemId]?.[wh.id] || 0;

                                const allocated =
                                  allocatedStock[
                                    `${selectedItemId}_${wh.id}`
                                  ] || 0;

                                const available = totalStock - allocated;

                                return (
                                  <Select.Option
                                    key={wh.id}
                                    value={wh.id}
                                    label={wh.name} // 👈 This is what shows after selection
                                  >
                                    <div>
                                      <strong>{wh.name}</strong>

                                      {selectedItemId && (
                                        <>
                                          <br />
                                          <span
                                            style={{
                                              fontSize: "12px",
                                              color: "#52c41a",
                                            }}
                                          >
                                            Available: {available} units
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </Select.Option>
                                );
                              })}
                            </Select>
                          </Form.Item>

                          <Form.Item
                            {...restField}
                            name={[name, "quantity"]}
                            label="Quantity"
                            rules={[
                              { required: true, message: "Enter qty" },
                              {
                                validator: (_, value) => {
                                  if (
                                    value &&
                                    selectedItemId &&
                                    selectedWarehouseId &&
                                    value > currentAvailable
                                  ) {
                                    return Promise.reject(
                                      `Only ${currentAvailable} available`,
                                    );
                                  }
                                  return Promise.resolve();
                                },
                              },
                            ]}
                            style={{ marginBottom: 0, width: 100 }}
                          >
                            <InputNumber
                              placeholder="Qty"
                              min={1}
                              max={currentAvailable || undefined}
                              style={{ width: "100%" }}
                              onChange={() => {
                                // Trigger re-render to update stock calculations
                                form.setFieldsValue({});
                              }}
                            />
                          </Form.Item>

                          <Form.Item
                            {...restField}
                            name={[name, "unitPrice"]}
                            label="Unit Price"
                            rules={[{ required: true, message: "Enter price" }]}
                            style={{ marginBottom: 0, width: 120 }}
                          >
                            <InputNumber
                              placeholder="Price"
                              min={0}
                              step={0.01}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>

                          <Form.Item label=" " style={{ marginBottom: 0 }}>
                            <Button onClick={() => remove(name)} danger>
                              Remove
                            </Button>
                          </Form.Item>
                        </Space>

                        {selectedItemId && selectedWarehouseId && (
                          <div
                            style={{
                              padding: "8px 12px",
                              backgroundColor: "#e6f7ff",
                              border: "1px solid #91d5ff",
                              borderRadius: 4,
                            }}
                          >
                            <span
                              style={{ fontSize: "13px", color: "#0050b3" }}
                            >
                              ℹ️{" "}
                              <strong>
                                {
                                  items.find((i) => i.id === selectedItemId)
                                    ?.name
                                }
                              </strong>{" "}
                              at{" "}
                              <strong>
                                {
                                  warehouses.find(
                                    (w) => w.id === selectedWarehouseId,
                                  )?.name
                                }
                              </strong>
                              :
                              {form.getFieldValue([
                                "lines",
                                name,
                                "quantity",
                              ]) && (
                                <span
                                  style={{ color: "#1890ff", marginLeft: 4 }}
                                >
                                  {form.getFieldValue([
                                    "lines",
                                    name,
                                    "quantity",
                                  ])}{" "}
                                  selected,
                                </span>
                              )}
                              <strong
                                style={{ color: "#52c41a", marginLeft: 4 }}
                              >
                                {currentAvailable -
                                  (form.getFieldValue([
                                    "lines",
                                    name,
                                    "quantity",
                                  ]) || 0)}{" "}
                                remaining
                              </strong>
                            </span>
                          </div>
                        )}
                      </Space>
                    </div>
                  );
                })}
                <Form.Item>
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    Add Line Item
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Create Sales Order
              </Button>
              <Button onClick={() => setModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* View SO Modal */}
      <Modal
        title={`Sales Order Details - ${selectedSOForView?.so_number}`}
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setSelectedSOForView(null);
        }}
        footer={[
          <Button 
            key="email"
            icon={<MailOutlined />}
            onClick={() => handleEmailSO(selectedSOForView)}
          >
            Email
          </Button>,
          <Button 
            key="print" 
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => printSO(selectedSOForView)}
          >
            Print
          </Button>,
          <Button 
            key="download" 
            icon={<DownloadOutlined />}
            onClick={() => downloadPDF(selectedSOForView)}
          >
            Download PDF
          </Button>,
          <Button
            key="close"
            onClick={() => {
              setViewModalVisible(false);
              setSelectedSOForView(null);
            }}
          >
            Close
          </Button>,
        ]}
        width={1000}
      >
        {selectedSOForView && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <strong>Customer:</strong> {selectedSOForView.customer_name}
              <br />
              <strong>Warehouse:</strong> {selectedSOForView.warehouse_name}
              <br />
              <strong>Status:</strong> {selectedSOForView.status?.toUpperCase()}
              <br />
              <strong>Order Date:</strong> {selectedSOForView.order_date}
              <br />
              <strong>Expected Ship Date:</strong>{" "}
              {selectedSOForView.expected_ship_date}
              <br />
              <strong>Currency:</strong> {selectedSOForView.currency}
              <br />
              <strong>Channel:</strong> {selectedSOForView.channel}
              <br />
              <strong>Total Amount:</strong> {selectedSOForView.currency}{" "}
              {selectedSOForView.total_amount}
              {selectedSOForView.status === 'cancelled' && selectedSOForView.cancellation_reason && (
                <>
                  <br />
                  <div style={{ marginTop: 12, padding: 12, backgroundColor: '#fff2e8', border: '1px solid #ffbb96', borderRadius: 4 }}>
                    <strong style={{ color: '#d4380d' }}>Cancellation Reason:</strong>
                    <div style={{ marginTop: 4, color: '#595959' }}>{selectedSOForView.cancellation_reason}</div>
                  </div>
                </>
              )}
            </div>

            <h4>Line Items:</h4>
            <Table
              dataSource={selectedSOForView.lines || []}
              rowKey="id"
              pagination={false}
              columns={[
                { title: "Item", dataIndex: "item_name", key: "item_name" },
                { title: "HSN Code", dataIndex: "hsn_code", key: "hsn_code", render: (val) => val || '-' },
                {
                  title: "Qty Ordered",
                  dataIndex: "quantity_ordered",
                  key: "quantity_ordered",
                },
                {
                  title: "Shipped",
                  dataIndex: "quantity_shipped",
                  key: "quantity_shipped",
                  render: (val) => val || 0,
                },
                {
                  title: "Unit Price",
                  dataIndex: "unit_price",
                  key: "unit_price",
                  render: (val) => `${selectedSOForView.currency} ${val}`,
                },
                {
                  title: "Line Total",
                  dataIndex: "line_total",
                  key: "line_total",
                  render: (val) => `${selectedSOForView.currency} ${val}`,
                },
                {
                  title: "Status",
                  dataIndex: "status",
                  key: "status",
                  render: (val) => val?.toUpperCase(),
                },
              ]}
            />
          </div>
        )}
      </Modal>

      <Modal
        title="Email Sales Order"
        open={emailModalVisible}
        onCancel={() => setEmailModalVisible(false)}
        onOk={handleSendEmail}
        okText="Send Email"
      >
        <p>Send sales order <strong>{selectedSOForEmail?.so_number}</strong> to:</p>
        <Input
          placeholder="Enter email address"
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          onPressEnter={handleSendEmail}
        />
      </Modal>

      <Modal
        title="Cancel Sales Order"
        open={cancelModalVisible}
        onCancel={() => setCancelModalVisible(false)}
        onOk={handleCancelSO}
        okText="Cancel Order"
        okButtonProps={{ danger: true }}
      >
        <p>
          Are you sure you want to cancel sales order{" "}
          <strong>{selectedSOForCancel?.so_number}</strong>?
        </p>
        <p style={{ marginTop: 16, marginBottom: 8 }}>
          <strong>Cancellation Reason:</strong>
        </p>
        <Input.TextArea
          placeholder="Please provide a reason for cancellation (required)"
          value={cancellationReason}
          onChange={(e) => setCancellationReason(e.target.value)}
          rows={4}
          maxLength={500}
          showCount
        />
        <p style={{ marginTop: 8, fontSize: '12px', color: '#888' }}>
          Note: Reserved stock will be automatically released.
        </p>
      </Modal>
    </div>
  );
};

export default SalesOrders;
