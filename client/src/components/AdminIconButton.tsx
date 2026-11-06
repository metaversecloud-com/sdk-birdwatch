export const AdminIconButton = ({
  setShowSettings,
  showSettings,
}: {
  setShowSettings: (value: boolean) => void;
  showSettings: boolean;
}) => {
  return (
    <button
      className="absolute right-2 width-10 height-10 mm-text-white bg-transparent text-3xl border-transparent cursor-pointer"
      onClick={() => setShowSettings(showSettings)}
    >
      {showSettings ? "←" : "⚙"}
    </button>
  );
};

export default AdminIconButton;
