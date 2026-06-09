import React, { useRef, useState } from "react";
import { WeatherProvider } from "./context/WeatherContext";
import BottomNav from "./components/BottomNav";
import HomePage from "./pages/HomePage";
import DetailPage from "./pages/DetailPage";
import SettingsPage from "./pages/SettingsPage";

const PAGES = { home: HomePage, detail: DetailPage, settings: SettingsPage };

export default function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const scrollRef = useRef(null);
  const PageComponent = PAGES[currentPage];

  const handlePageChange = (page) => {
    setCurrentPage(page);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  return (
    <WeatherProvider>
      <div className="min-h-screen bg-slate-300 flex justify-center" style={{ fontFamily: "Inter, sans-serif" }}>
        <div
          ref={scrollRef}
          className="w-full max-w-[393px] min-h-screen flex flex-col overflow-y-auto relative"
          style={{ scrollbarWidth: "none" }}
        >
          <PageComponent />
          <BottomNav current={currentPage} onChange={handlePageChange} scrollRef={scrollRef} />
        </div>
      </div>
    </WeatherProvider>
  );
}