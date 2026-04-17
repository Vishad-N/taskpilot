export default function StatCard({
  title,
  value
}:{
  title:string
  value:number
}){

  return(

    <div className="bg-white text-black border rounded-xl shadow-sm p-6">

      <p className="text-gray-500">
        {title}
      </p>

      <h2 className="text-3xl font-bold mt-2">
        {value}
      </h2>

    </div>

  )
}
