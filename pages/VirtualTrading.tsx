// pages/VirtualTrading.tsx
// dev-2 기준 루트 `VirtualTrading.tsx`(Virtual Trading Floor 전체 UI/로직)를 그대로 사용하는 라우팅 래퍼
import React from "react";
import VirtualTradingImpl from "../VirtualTrading";

const VirtualTradingPage: React.FC = () => {
  return <VirtualTradingImpl />;
};

export default VirtualTradingPage;


