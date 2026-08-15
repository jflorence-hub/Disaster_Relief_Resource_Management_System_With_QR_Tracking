import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Shield,
  ArrowRight,
  QrCode,
  Package,
  Truck,
  Users,
  LogIn,
  UserPlus,
} from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Package,
      title: "Resource Management",
      desc: "Track inventory and manage supplies in real-time",
    },
    {
      icon: QrCode,
      title: "QR Code Tracking",
      desc: "Generate and scan QR codes for quick identification",
    },
    {
      icon: Truck,
      title: "Distribution System",
      desc: "Coordinate and track resource distribution",
    },
    {
      icon: Users,
      title: "Team Management",
      desc: "Manage volunteers and coordinate relief efforts",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                DR
              </div>
              <span className="text-lg font-bold text-slate-800">
                Disaster Relief
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <LogIn size={18} />
                Login
              </Link>
              <Link
                to="/register"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                <UserPlus size={18} />
                Register
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <Shield size={16} />
              Disaster Response System
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-800 leading-tight">
              Disaster Relief Resource Management
            </h1>
            <p className="mt-4 text-lg text-slate-500 max-w-lg leading-relaxed">
              Efficiently manage and track disaster relief resources with{" "}
              <span className="text-blue-600 font-medium">
                QR code technology
              </span>
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                Get Started
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/login"
                className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Login
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">
                    Resource Management
                  </p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                  <QrCode className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">
                    QR Tracking
                  </p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 text-center">
                  <Truck className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">
                    Distribution
                  </p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 text-center">
                  <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">
                    Team Management
                  </p>
                </div>
              </div>
              <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Active Resources</span>
                  <span className="font-bold text-slate-800">1,254</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-slate-500">QR Scans Today</span>
                  <span className="font-bold text-slate-800">893</span>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-3 -right-3 w-24 h-24 bg-blue-600/10 rounded-full blur-2xl -z-10"></div>
            <div className="absolute -top-3 -left-3 w-32 h-32 bg-indigo-600/10 rounded-full blur-2xl -z-10"></div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-slate-800">Key Features</h2>
          <p className="text-slate-500 mt-1">
            Everything you need to manage disaster relief operations
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <feature.icon size={24} />
              </div>
              <h3 className="font-semibold text-slate-800">{feature.title}</h3>
              <p className="text-sm text-slate-500 mt-1">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>© 2026 Disaster Relief Resource Management</span>
            <span>Built with ❤️ for disaster response</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
