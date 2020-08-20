import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) throw new AppError('Customer must exists');

    const productsAvailable = await this.productsRepository.findAllById(
      products,
    );

    if (!productsAvailable.length) throw new AppError('Products must exists');

    if (products.length !== productsAvailable.length)
      throw new AppError('All Products must exists ');

    const productsWithQuantity = productsAvailable.filter(productAvailable => {
      return productsAvailable.filter(productOrder => {
        return (
          productOrder.id === productAvailable.id &&
          productOrder.quantity <= productAvailable.quantity
        );
      })[0];
    });

    if (productsWithQuantity.length < products.length)
      throw new AppError('Existe items without quantity needed');

    const productsTocreateOrder = products.map(product => {
      return {
        product_id: product.id,
        quantity: product.quantity,
        price: productsWithQuantity.filter(
          productDataBase => product.id === productDataBase.id,
        )[0].price,
      };
    });
    const order = this.ordersRepository.create({
      customer,
      products: productsTocreateOrder,
    });

    const updateproductObject = products.map(product => {
      return {
        id: product.id,
        quantity:
          productsWithQuantity.filter(
            productAvailable => productAvailable.id == product.id,
          )[0].quantity - product.quantity,
      };
    });

    await this.productsRepository.updateQuantity(updateproductObject);

    return order;
  }
}

export default CreateOrderService;
