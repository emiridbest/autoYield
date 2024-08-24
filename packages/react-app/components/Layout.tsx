import { FC, ReactNode } from "react";
import Footer from "./Footer";
import Header from "./Header";

interface Props {
    children: ReactNode;
}
const Layout: FC<Props> = ({ children }) => {
    return (
        <>
            <Header />
            <div className="bg-gypsum overflow-hidden flex flex-col min-h-screen">
                <div className="py-3 w-full mx-auto space-y-8 sm:px-6 lg:px-8">
                    {children}
                </div>
            </div>
            <Footer />
        </>
    );
};

export default Layout;
