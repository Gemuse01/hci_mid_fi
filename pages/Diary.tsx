// pages/Diary.tsx
// dev-2 기준 루트 `Diary.tsx`(Investment Diary 전체 UI/로직)를 그대로 사용하는 라우팅 래퍼
import React from "react";
import DiaryImpl from "../Diary";

const DiaryPage: React.FC = () => {
  return <DiaryImpl />;
};

export default DiaryPage;


