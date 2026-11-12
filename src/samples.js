// Clearly labeled illustrative sample datasets for local DataLens demonstration

export const SAMPLE_DATASETS = {
  ecommerce: {
    label: "E-Commerce Orders (Sample Data)",
    csv: `order_id,order_date,region,category,units,unit_price,discount_pct,shipping_days,order_total
ORD-1001,2026-09-02,Lahore,Electronics,2,14500,5,2,27550
ORD-1002,2026-09-03,Karachi,Home & Kitchen,3,2400,0,3,7200
ORD-1003,2026-09-04,Islamabad,Electronics,1,32000,10,1,28800
ORD-1004,2026-09-05,Lahore,Apparel,4,1850,0,2,7400
ORD-1005,2026-09-06,Karachi,Electronics,2,18900,8,4,34776
ORD-1005,2026-09-06,Karachi,Electronics,2,18900,8,4,34776
ORD-1006,2026-09-07,Rawalpindi,Groceries,6,950,,1,5700
ORD-1007,2026-09-08,Lahore,Apparel,2,4200,5,2,7980
ORD-1008,2026-09-09,Islamabad,Home & Kitchen,1,11500,0,2,11500
ORD-1009,2026-09-10,Karachi,Groceries,8,780,5,1,5928
ORD-1010,2026-09-11,Faisalabad,Electronics,1,45000,12,5,39600
ORD-1011,2026-09-12,Lahore,Home & Kitchen,2,,0,2,6400
ORD-1012,2026-09-13,Islamabad,Apparel,3,2900,10,2,7830
ORD-1013,2026-09-14,Multan,Groceries,5,1120,0,3,5600
ORD-1014,2026-09-15,Karachi,Electronics,3,21000,5,2,59850
ORD-1015,2026-09-16,Lahore,Groceries,7,890,0,1,6230`
  },
  security: {
    label: "Network Telemetry Logs (Sample Data)",
    csv: `event_id,protocol,dst_port,bytes_sent,bytes_recv,duration_ms,anomaly_score,severity
EVT-01,TCP,443,1240,8420,42,0.12,Low
EVT-02,DNS,53,84,162,14,0.08,Low
EVT-03,TCP,443,2190,14500,68,0.15,Low
EVT-04,TCP,22,640,420,190,0.48,Medium
EVT-05,TCP,80,380,1290,55,0.61,Medium
EVT-06,TCP,445,180,0,310,0.84,High
EVT-07,DNS,53,240,180,29,0.79,High
EVT-08,TCP,3389,920,410,410,0.88,High
EVT-09,TCP,443,1680,11200,51,0.11,Low
EVT-10,ICMP,0,74,74,9,0.05,Low
EVT-11,TCP,4444,540,120,,0.94,Critical
EVT-12,TCP,443,1420,9800,48,0.14,Low
EVT-13,TCP,23,260,90,260,0.86,High
EVT-14,DNS,53,96,174,16,0.09,Low`
  },
  students: {
    label: "CS Skills Survey (Sample Data)",
    csv: `student_id,track,hours_per_week,projects_completed,gpa,test_score,internship_ready
STU-01,Full-Stack,18,5,3.62,86,Yes
STU-02,Cybersecurity,22,4,3.48,89,Yes
STU-03,Data Analytics,16,4,3.75,91,Yes
STU-04,Full-Stack,10,2,3.05,72,No
STU-05,Cybersecurity,20,6,3.55,88,Yes
STU-06,Data Analytics,14,3,3.30,81,Yes
STU-07,Full-Stack,24,7,3.82,94,Yes
STU-08,Data Analytics,8,1,2.85,68,No
STU-09,Cybersecurity,19,5,,85,Yes
STU-10,Full-Stack,15,3,3.21,78,No
STU-11,Data Analytics,21,6,3.79,92,Yes
STU-12,Cybersecurity,12,2,3.10,75,No`
  }
};
