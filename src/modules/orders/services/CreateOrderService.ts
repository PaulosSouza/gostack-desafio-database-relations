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
    const productsFound = await this.productsRepository.findAllById(products);

    if (!productsFound) {
      throw new AppError('Product was not found');
    }

    if (!customer) {
      throw new AppError('Customer was not found');
    }

    const hasProductQuantity = productsFound.every(productFound => {
      const productToCompare = products.find(
        product => product.id === productFound.id,
      );

      return (
        productToCompare && productToCompare.quantity <= productFound.quantity
      );
    });

    if (!hasProductQuantity) {
      throw new AppError("There aren't quantity products enough.");
    }

    const productsQuantityUpdated = await this.productsRepository.updateQuantity(
      products,
    );

    const productsUpdatedFormatted = productsQuantityUpdated.map(
      ({ price, quantity, id }) => {
        return {
          product_id: id,
          price,
          quantity,
        };
      },
    );

    const orders = await this.ordersRepository.create({
      customer,
      products: productsUpdatedFormatted,
    });

    orders.order_products.map(orderProduct => {
      const productFound = products.find(
        product => product.id === orderProduct.product_id,
      );

      if (productFound) {
        const updateOrderProduct = Object.assign(orderProduct, {
          quantity: productFound.quantity,
        });

        return updateOrderProduct;
      }

      return orderProduct;
    });

    return orders;
  }
}

export default CreateOrderService;
