import React, { useState, useEffect, useRef } from "react";
import { Card, Button, Modal, Input, message, Upload, Spin, Tag, Row, Col, Typography } from "antd";
import { CameraOutlined, EnvironmentOutlined, CheckCircleOutlined } from "@ant-design/icons";
import SignatureCanvas from "react-signature-canvas";
import api from "../../../../api/client.js";
import { startTracking, stopTracking } from "./GpsTracker.js";

const { Title, Text } = Typography;

export default function DriverApp() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [podModalVisible, setPodModalVisible] = useState(false);
  const [currentTripId, setCurrentTripId] = useState(null);
  const [podNotes, setPodNotes] = useState("");
  const sigCanvas = useRef(null);

  const fetchTrips = async () => {
    setLoading(true);
    try {
      // Typically we'd filter by driver_id based on logged in user, mock for now
      const res = await api.get("/transport/trips");
      if (res.data?.success) {
        // Filter to only show IN_TRANSIT or SCHEDULED for mobile
        const activeTrips = (res.data.data.items || []).filter(t => t.status !== 'CANCELLED' && t.status !== 'COMPLETED');
        setTrips(activeTrips);
      }
    } catch (err) {
      message.error("Failed to load your trips.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
    return () => {
      stopTracking();
    };
  }, []);

  const handleStartTrip = async (tripId, vehicleId) => {
    // Attempt to capture GPS
    let lat = null;
    let lng = null;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        console.warn("Could not capture GPS on start", e);
      }
    }

    const success = startTracking(tripId, vehicleId);
    if (success) {
      message.success("Trip Started! GPS tracking active.");
      
      try {
        // Update backend status to IN_TRANSIT by calling start endpoint
        await api.put(`/transport/trips/${tripId}/start`, { 
          latitude: lat,
          longitude: lng
        });
        fetchTrips();
      } catch (err) {
        console.error("Failed to start trip", err);
      }

      // Automatically use Google Maps navigation to track vehicle position / direct the driver
      const trip = trips.find(t => t.id === tripId);
      if (trip) {
        let originQuery = "";
        if (trip.origin_lat && trip.origin_lng) {
          originQuery = `&origin=${trip.origin_lat},${trip.origin_lng}`;
        } else if (trip.origin_name) {
          originQuery = `&origin=${encodeURIComponent(trip.origin_name)}`;
        }

        if (trip.destination_lat && trip.destination_lng) {
          const url = `https://www.google.com/maps/dir/?api=1${originQuery}&destination=${trip.destination_lat},${trip.destination_lng}&travelmode=driving`;
          window.open(url, "_blank");
        } else if (trip.destination_name) {
          const encodedDest = encodeURIComponent(trip.destination_name);
          const url = `https://www.google.com/maps/dir/?api=1${originQuery}&destination=${encodedDest}&travelmode=driving`;
          window.open(url, "_blank");
        } else {
          message.warning("No destination coordinates available for navigation.");
        }
      }
    }
  };

  const handleOpenPod = (tripId) => {
    setCurrentTripId(tripId);
    setPodModalVisible(true);
  };

  const handleCompleteTrip = async () => {
    if (sigCanvas.current.isEmpty()) {
      message.warning("Please provide a signature");
      return;
    }
    
    const signatureDataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL("image/png");
    
    try {
      await api.post(`/transport/trips/${currentTripId}/pod`, {
        pod_signature_url: signatureDataUrl,
        pod_photo_url: null, // Hook up real photo upload here
        pod_notes: podNotes
      });
      message.success("Proof of Delivery submitted!");
      setPodModalVisible(false);
      stopTracking();
      fetchTrips();
    } catch (err) {
      message.error("Failed to submit POD");
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div style={{ padding: 16, background: "#f0f2f5", minHeight: "100vh" }}>
      <Title level={4}>My Active Trips</Title>
      
      {trips.length === 0 ? (
        <Card>
          <Text type="secondary">You have no active trips assigned.</Text>
        </Card>
      ) : (
        trips.map(trip => (
          <Card key={trip.id} style={{ marginBottom: 16, borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0 }}>Trip #{trip.trip_number}</Title>
              <Tag color={trip.status === 'IN_TRANSIT' ? 'processing' : 'default'}>{trip.status}</Tag>
            </div>
            
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Route ID: {trip.route_id || "Unassigned"} <br/>
              Vehicle: {trip.reg_number}
            </Text>

            <Row gutter={8}>
              <Col span={12}>
                <Button 
                  type="primary" 
                  block 
                  icon={<EnvironmentOutlined />}
                  onClick={() => handleStartTrip(trip.id, trip.vehicle_id)}
                  disabled={trip.status === 'IN_TRANSIT'}
                >
                  Start GPS
                </Button>
              </Col>
              <Col span={12}>
                <Button 
                  type="primary" 
                  danger 
                  block 
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleOpenPod(trip.id)}
                >
                  Complete
                </Button>
              </Col>
            </Row>
          </Card>
        ))
      )}

      {/* Proof of Delivery Modal */}
      <Modal
        title="Proof of Delivery"
        open={podModalVisible}
        onOk={handleCompleteTrip}
        onCancel={() => setPodModalVisible(false)}
        okText="Submit & Complete"
        width={400}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Customer Signature</Text>
          <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, marginTop: 8, background: '#fafafa' }}>
            <SignatureCanvas 
              ref={sigCanvas} 
              canvasProps={{ width: 350, height: 150, className: 'sigCanvas' }} 
            />
          </div>
          <Button size="small" type="link" onClick={() => sigCanvas.current.clear()}>Clear Signature</Button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text strong>Delivery Photo (Optional)</Text>
          <Upload maxCount={1} accept="image/*">
            <Button icon={<CameraOutlined />} block style={{ marginTop: 8 }}>
              Take Photo
            </Button>
          </Upload>
        </div>

        <div>
          <Text strong>Delivery Notes</Text>
          <Input.TextArea 
            rows={3} 
            style={{ marginTop: 8 }} 
            value={podNotes}
            onChange={(e) => setPodNotes(e.target.value)}
            placeholder="Condition of goods, receiver name, etc."
          />
        </div>
      </Modal>
    </div>
  );
}
