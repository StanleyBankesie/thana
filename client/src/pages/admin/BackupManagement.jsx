import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  Button,
  Card,
  Typography,
  Space,
  Popconfirm,
  Tag,
  Tooltip,
} from "antd";
import {
  Download,
  Trash2,
  PlayCircle,
  HardDrive,
  Cloud,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../api/client.js";

const { Title, Text } = Typography;

export default function BackupManagement() {
  const navigate = useNavigate();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [triggeringLocal, setTriggeringLocal] = useState(false);
  const [triggeringCloud, setTriggeringCloud] = useState(false);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await api.get("/backups");
      setBackups(res.data?.backups || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to fetch backups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const triggerBackup = async (localOnly = false, cloudOnly = false) => {
    try {
      if (localOnly) setTriggeringLocal(true);
      else if (cloudOnly) setTriggeringCloud(true);

      toast.info(
        `Triggering ${localOnly ? "local" : "cloud"} backup... This may take a few minutes.`,
      );
      await api.post("/backups/trigger", { localOnly, cloudOnly });
      toast.success("Backup completed successfully!");
      fetchBackups();
    } catch (err) {
      toast.error(err?.response?.data?.details || err?.response?.data?.error || err?.message || "Failed to trigger backup");
    } finally {
      if (localOnly) setTriggeringLocal(false);
      else if (cloudOnly) setTriggeringCloud(false);
    }
  };

  const deleteBackup = async (filename) => {
    try {
      await api.delete(`/backups/${encodeURIComponent(filename)}`);
      toast.success(`Deleted ${filename}`);
      fetchBackups();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to delete backup");
    }
  };

  const apiBase = String(api.defaults.baseURL || "/api").replace(/\/$/, "");

  const columns = [
    {
      title: "Filename",
      dataIndex: "filename",
      key: "filename",
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (type) => (
        <Tag color={type === "Database" ? "blue" : "purple"}>{type}</Tag>
      ),
    },
    {
      title: "Size",
      dataIndex: "size",
      key: "size",
      render: (size) => {
        const mb = (size / (1024 * 1024)).toFixed(2);
        return `${mb} MB`;
      },
    },
    {
      title: "Created At",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="Download">
            <Button
              type="primary"
              icon={<Download size={16} />}
              href={`${apiBase}/backups/download/${encodeURIComponent(record.filename)}`}
              target="_blank"
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Popconfirm
              title="Delete this backup?"
              description="Are you sure you want to permanently delete this backup?"
              onConfirm={() => deleteBackup(record.filename)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="primary" danger icon={<Trash2 size={16} />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "16px" }}>
        <Button
          type="text"
          icon={<ArrowLeft size={16} />}
          onClick={() => navigate("/administration")}
          style={{
            paddingLeft: 0,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#64748b",
          }}
        >
          Back to Administration
        </Button>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            System Backups
          </Title>
          <Text type="secondary">Manage your local and cloud backups.</Text>
        </div>
        <Space>
          <Button
            type="default"
            icon={<HardDrive size={16} />}
            onClick={() => triggerBackup(true, false)}
            loading={triggeringLocal}
            disabled={triggeringCloud}
          >
            Backup Locally
          </Button>
          <Button
            type="primary"
            icon={<Cloud size={16} />}
            onClick={() => triggerBackup(false, true)}
            loading={triggeringCloud}
            disabled={triggeringLocal}
          >
            Back up to Cloud
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={backups}
          rowKey="filename"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Card
        style={{
          marginTop: "24px",
          backgroundColor: "#f6ffed",
          borderColor: "#b7eb8f",
        }}
      >
        <Space align="start">
          <CheckCircle color="#52c41a" size={24} style={{ marginTop: 4 }} />
          <div>
            <Text strong style={{ fontSize: 16 }}>
              Automated Backups are Active
            </Text>
            <br />
            <Text type="secondary">
              Database backups run automatically every night at 12:00 AM and are
              pushed to the configured cloud storage. Manual backups act as a
              fallback and will also immediately push data to the cloud and send
              email notifications.
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
}
