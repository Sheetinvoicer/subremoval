'use client'

export default function Table({ headers, data, renderRow, onRowClick, emptyMessage = "No data available" }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              {headers.map((header, index) => (
                <th key={index} className="text-left p-4 text-gray-700 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="text-center py-12 text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => renderRow(item, index, onRowClick))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
